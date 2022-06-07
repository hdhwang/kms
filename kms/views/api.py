from copy import deepcopy

import json
from django.db import connection
from django.http import JsonResponse, HttpResponse
from rest_framework.exceptions import ParseError
from kms.authentication import TokenAuthentication
from kms.util.dicHelper import dict_fetch_all
from kms.util.formatHelper import *
from kms.util.logHelper import insert_audit_log
from kms.util.networkHelper import get_client_ip
from kms.util.regexHelper import *
from rest_framework.decorators import api_view, authentication_classes, permission_classes
from kms.permission import IsAuthenticated
from kms import models
from kms.serializers import KeyinfoSerializer
from kms.views.keyinfo import get_dec_value, make_enc_value
from rest_framework.response import Response
from jsonschema import validate, ValidationError

import logging

logger = logging.getLogger(__name__)
category = 'API 요청'


@api_view(['GET', 'POST', 'DELETE', 'PUT'])
@authentication_classes((TokenAuthentication,))
@permission_classes((IsAuthenticated,))
def api(request):
    try:
        # 사용자 ID
        userID = request.user.id

        # 감사 로그 > 내용
        actions = []

        # 감사 로그 > 결과
        result = False

        # 보조 카테고리 설정
        if request.method == 'GET':
            sub_category = '조회'
        elif request.method == 'POST':
            sub_category = '추가'
        elif request.method == 'PUT':
            sub_category = '편집'
        elif request.method == 'DELETE':
            sub_category = '삭제'
        else:
            sub_category = request.method

        # 감사 로그 > value 남기지 않도록 처리
        if request.method == "POST" or request.method == "PUT":
            if request.data.get("data"):
                tmp = deepcopy(request.data["data"])
                for i in tmp:
                    if i.get("value"):
                        i["value"] = '******'

        # IP 접근제어 확인
        if check_ip_whitelist(request) is False:
            actions.append(f'IP 접근 권한 없음')
            return Response(status=403)

        # 키 조회
        if request.method == 'GET':
            # 기능 on/off 확인
            if check_settings(request.method):
                if request.GET:
                    if len(request.GET.getlist('key')) > 1:
                        actions.append(f'[요청]: {list_to_str(request.GET.getlist("key"))} (KEY 파라미터 다중 사용)')
                        return JsonResponse(status=400, data={'detail': 'Only one key parameter can be used'})

                    if request.GET.get('key'):
                        key_list = request.GET.get('key').replace(' ', '').split(',')
                        actions.append(f'[요청]: {list_to_str(key_list)}')
                        queryset = models.Keyinfo.objects.filter(user_id=userID, key__in=key_list)
                        serializer = KeyinfoSerializer(queryset, many=True)
                else:
                    actions.append(f'[요청]: 전체 조회')
                    queryset = models.Keyinfo.objects.filter(user_id=request.user.id)
                    serializer = KeyinfoSerializer(queryset, many=True)

                exists_key_list = []
                for data in serializer.data:
                    exists_key_list.append(data['key'])
                    data['value'] = get_dec_value(data['value'])

                    if json_validator2(data['value']):
                        data['value'] = json.loads(data['value'])

                actions.append(f'[응답]: {list_to_str(exists_key_list)}' if exists_key_list else f', [응답]: None')
                result = True

                return Response(data={"data": serializer.data}, status=200)
            else:
                actions.append(f'METHOD 비활성')
                return HttpResponse(status=400)

        # 키 저장
        elif request.method == 'POST':
            # 기능 on/off 확인
            if check_settings(request.method):
                # json schema 체크
                chk_json, key_list = json_validator(request.data, request.method)
                if chk_json is False:
                    actions.append(f'[요청]: 문법 오류 또는 필수값 누락')
                    return JsonResponse(status=400, data={'detail': 'Invalid syntax or Missing required value'})

                # body 내 중복 키 존재 유무 체크
                if len(key_list) != len(set(key_list)):
                    actions.append(f'[요청]: {list_to_str(key_list)} (요청 내용에 중복된 KEY가 존재)')
                    return JsonResponse(status=400, data={'detail': 'Duplicate key exists in requested value'})

                # 사용할 수 없는 문자 존재 유무 체크
                if character_validator(key_list):
                    actions.append(f'[요청]: {list_to_str(key_list)} (KEY에 사용할 수 없는 문자가 포함되어 있음)')
                    return JsonResponse(status=422, data={'detail': 'Contains characters that cannot be used'})

                # 동일 키 존재 유무 체크([user_id, key] unique key)
                if models.Keyinfo.objects.filter(user_id=userID, key__in=key_list).exists():
                    data = models.Keyinfo.objects.filter(user_id=userID, key__in=key_list)
                    exists_key_list = []
                    for i in data:
                        exists_key_list.append(i.key)
                    actions.append(f'[요청]: {list_to_str(key_list)} (요청 내용에 이미 등록되어 있는 KEY 존재)')
                    return JsonResponse(status=400, data={'detail': f'Key already registered {exists_key_list}'})

                # 데이터 삽입
                for data in request.data["data"]:
                    models.Keyinfo.objects.create(user_id=userID, key=data["key"],
                                                  value=make_enc_value(json.dumps(data["value"])),
                                                  description=data["description"], created_date=datetime.now())

                actions.append(f'[요청]: {list_to_str(tmp)}')
                result = True
                return HttpResponse(status=204)

            else:
                actions.append(f'METHOD 비활성')
                return HttpResponse(status=400)

        # 키 수정 (단일 키에 대한 dsecription 만 수정 가능)
        elif request.method == 'PUT':
            # 기능 on/ff 확인
            if check_settings(request.method):
                if request.GET and len(request.GET.getlist('key')):
                    if len(request.GET.getlist('key')) > 1:
                        actions.append(f'[요청]: {list_to_str(request.GET.getlist("key"))} (KEY 파라미터 다중 사용)')
                        return JsonResponse(status=400, data={'detail': 'Only one key parameter can be used'})

                    key_list = request.GET.get('key').replace(' ', '').split(',')
                    if len(key_list) > 1:
                        actions.append(f'[요청]: {request.GET.get("key")} (KEY 다중 입력)')
                        return JsonResponse(status=400, data={'detail': 'Only one key can be entered'})

                    # json schema 체크
                    chk_json = json_validator(request.data, request.method)
                    if chk_json is False:
                        actions.append(f'[요청]: 문법 오류 또는 필수값 누락')
                        return JsonResponse(status=400, data={'detail': 'Invalid syntax or Missing required value'})

                    # request.data의 값이 여러개 인지 체크
                    if len(request.data["data"]) > 1:
                        actions.append(f'[요청]: {list_to_str(tmp)} (Description 다중 입력)')
                        return JsonResponse(status=400, data={'detail': 'Only one description can be entered'})

                    if request.GET.get('key'):
                        # key가 존재하면 수정 수행
                        if models.Keyinfo.objects.filter(user_id=userID, key=request.GET.get('key')).exists():
                            data = models.Keyinfo.objects.get(user_id=userID, key=request.GET.get('key'))
                            org_desc = data.description

                            models.Keyinfo.objects.filter(user_id=userID, key=request.GET.get('key')).\
                                update(description=request.data["data"][0]["description"])

                            actions.append(f'[요청]: (KEY:"{request.GET.get("key")}"){list_to_str(request.data["data"])}')
                            actions.append(f'[처리]: {org_desc} → {request.data["data"][0]["description"]}')
                            result = True
                            return HttpResponse(status=204)
                        else:
                            actions.append(f'[요청]: {request.GET.get("key")} (수정할 키 없음)')
                            return JsonResponse(status=400, data={'detail': 'No key to modify'})

                actions.append(f'필수 파라미터 누락')
                return JsonResponse(status=400, data={'detail': 'Missing Required Parameter'})

            else:
                actions.append(f'METHOD 비활성')
                return HttpResponse(status=400)

        # 키 삭제 (단일 키만 삭제 가능)
        elif request.method == 'DELETE':
            # 기능 on/off 확인
            if check_settings(request.method):
                if request.GET and len(request.GET.getlist('key')):
                    if len(request.GET.getlist('key')) > 1:
                        actions.append(f'[요청]: {list_to_str(request.GET.getlist("key"))} (KEY 파라미터 다중 사용)')
                        return JsonResponse(status=400, data={'detail': 'Only one key parameter can be used'})

                    key_list = request.GET.get('key').replace(' ', '').split(',')
                    if len(key_list) > 1:
                        actions.append(f'[요청]: {to_str(request.GET.get("key"))} (KEY 다중 입력)')
                        return JsonResponse(status=400, data={'detail': 'Only one key can be entered'})

                    if request.GET.get('key'):
                        # key가 존재하면 삭제 수행
                        if models.Keyinfo.objects.filter(user_id=userID, key=request.GET.get('key')).exists():
                            models.Keyinfo.objects.filter(user_id=userID, key=request.GET.get('key')).delete()

                            actions.append(f'[요청]: (KEY:"{request.GET.get("key")}")')
                            result = True
                            return HttpResponse(status=204)
                        else:
                            actions.append(f'[요청]: {request.GET.get("key")} (삭제할 키 없음)')
                            return JsonResponse(status=400, data={'detail': 'No key to delete'})

                actions.append(f'필수 파라미터 누락')
                return JsonResponse(status=400, data={'detail': 'Missing Required Parameter'})

            else:
                actions.append(f'METHOD 비활성')
                return HttpResponse(status=400)

    except ParseError as pe:
        actions.append(f'{to_str(pe)}')
        logger.warning(f'[api] {to_str(pe)}')
        return JsonResponse(status=400, data={'detail': 'JSON parse error'})

    except Exception as e:
        actions.append(f'{to_str(e)}')
        logger.warning(f'[api] {to_str(e)}')
        return HttpResponse(status=400)

    finally:
        audit_log = f"""{', '.join(actions)}"""
        insert_audit_log(userID, request, category, sub_category, audit_log, result)


# 요청에 대한 API 기능 허용 여부
def check_settings(method):
    try:
        key_dic = dict(GET='ENABLE_GET_API', POST='ENABLE_POST_API', PUT='ENABLE_PUT_API', DELETE='ENABLE_DELETE_API')
        queryset = models.Settings.objects.get(key=key_dic[method])

        return True if queryset.value == 'Y' else False

    except Exception as e:
        logger.warning(f'[check_settings] {to_str(e)}')
        return False

    return False


# 요청에 대한 허용 IP 여부 확인
def check_ip_whitelist(request):
    result = False

    try:
        request_ip = get_client_ip(request)
        sql = '''SELECT COUNT(*) AS `count`
        FROM ip_whitelist
        WHERE INET_ATON(%s) >= ip & 0xffffffff ^ ((0x1 << ( 32 - cidr)  ) -1 )
        AND INET_ATON(%s) <= ip | ((0x100000000 >> cidr ) -1 )'''

        # SQL Injection 방지를 위해 escape 처리할 입력 값 리스트
        replace_list = [request_ip, request_ip]

        cur = connection.cursor()
        if cur.execute(sql, replace_list):
            data_list = list(dict_fetch_all(cur))

            if data_list and data_list[0].get('count'):
                result = True

    except Exception as e:
        logger.warning(f'[check_ip_whitelist] {to_str(e)}')

    finally:
        return result

# body 유효성 체크
def json_validator(body_data, method):
    try:
        keyinfo_schema = {}
        result = False
        key_list = []

        if method == 'POST':
            keyinfo_schema = {
                "properties": {
                    "key": {"type": "string", "minLength": 1, "maxLength": 64},
                    "value": {"minLength": 1},
                    "description": {"type": "string", "maxLength": 128}
                },
                "additionalProperties": False,
                "required": ["key", "value"]
            }

        if method == 'PUT':
            keyinfo_schema = {
                "properties": {
                    "description": {"type": "string", "maxLength": 128}
                },
                "additionalProperties": False,
                "required": ["description"]
            }

        if body_data.get("data"):
            for data in body_data["data"]:
                validate(schema=keyinfo_schema, instance=data)
                if method == 'POST':
                    key_list.append((data["key"]))
            result = True
        else:
            raise ValidationError('No data key in json')

    except ValidationError as ve:
        logger.warning(f'[json_validator] {to_str(ve)}')

    except Exception as e:
        logger.warning(f'[json_validator] {to_str(e)}')

    finally:
        if method == 'POST':
            return result, key_list
        return result


# 사용 불가 문자 포함 체크
def character_validator(key_list):
    try:
        result = False

        for key in key_list:
            if invalid_char_regex.findall(key):
                result = True
                return result

    except Exception as e:
        logger.warning(f'[character_validator] {to_str(e)}')

    finally:
        return result


# value type 체크
def json_validator2(value):
    try:
        json.loads(value)
        return True

    except Exception as e:
        return False