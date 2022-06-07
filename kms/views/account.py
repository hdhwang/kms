from django.contrib import auth
from django.contrib.auth import password_validation
from django.contrib.auth.hashers import check_password
from django.contrib.auth.models import User, Group
from django.core.exceptions import ValidationError
from django.db.models import CharField, DateTimeField
from django.db.models.functions import Cast, TruncSecond
from django.http import JsonResponse, HttpResponse
from django.http.multipartparser import MultiPartParser
from django.shortcuts import HttpResponseRedirect
from django.views.generic import TemplateView, View
from django.utils.decorators import method_decorator
from django.contrib.auth.decorators import permission_required
from rest_framework.authtoken.models import Token
from kms.util.logHelper import insert_audit_log
from kms.util.dicHelper import insert_dic_data, get_dic_value
from kms.util.mailHelper import *
from kms.util.regexHelper import *

import json
import logging
logger = logging.getLogger(__name__)

# 감사 로그 > 카테고리
category = '계정 관리'
key_info_category = '키 관리'


class PasswordChangeDoneView(View):
    def get(self, request):
        # 비밀번호 변경 성공 시 로그아웃 수행
        user = request.user.id
        auth.logout(request)

        # 로그아웃 감사 로그 기록
        insert_audit_log(user, request, '계정', '로그아웃', '비밀번호 변경', 'Y')

        return HttpResponseRedirect('/dashboard')


# 계정 관리 > 사용자 관리
class UsersView(TemplateView):
    template_name = 'kms/account/users.html'
    context = {}

    def get(self, request, *args, **kwargs):
        return self.render_to_response(self.context)


class UsersAPI(View):
    @method_decorator(permission_required('kms.view_user', raise_exception=True))
    def get(self, request):
        try:
            filter_params = {}
            user_id = request.user.id

            # 컬럼 리스트
            column_list = ('last_login', 'is_superuser', 'username', 'first_name', 'email', 'is_active', 'date_joined')

            # LIMIT 시작 인덱스
            limit_start = 0

            # LIMIT 종료 인덱스
            limit_end = None

            # 정렬 설정
            ordering = '-date_joined'  # 기본 값 : 일자 (최신) 기준

            # LIMIT 및 필터 설정
            for param in request.GET.items():
                key = param[0]
                value = param[1]

                # LIMIT 시작 인덱스
                if key == 'start':
                    limit_start = to_int(value)

                # LIMIT 종료 인덱스
                elif key == 'length' and to_int(value) > -1:
                    limit_end = limit_start + to_int(value)

                # XSS 방지를 위한 파라미터
                elif key == 'draw':
                    draw = value

                # 정렬 설정
                elif key == 'order[order]':
                    req_ordering = value
                    req_order_dir = request.GET.get('order[dir]')

                    # _last_login가 입력된 경우 실제 필드인 date로 치환
                    if req_ordering == '_last_login':
                        req_ordering = 'last_login'

                    # _date_joined가 입력된 경우 실제 필드인 date로 치환
                    elif req_ordering == '_date_joined':
                        req_ordering = 'date_joined'

                    if req_ordering in column_list:
                        ordering = req_order_dir + req_ordering

                # 필터 설정
                elif table_filter_regex.search(key) and value != '':
                    filter_key = f'{key.split("[value]")[0]}[data]'
                    filter_name = get_dic_value(request.GET, filter_key)

                    if filter_name == 'is_superuser':
                        insert_dic_data(filter_params, 'is_superuser', value)

                    elif filter_name == 'username':
                        insert_dic_data(filter_params, 'username__icontains', value)

                    elif filter_name == 'first_name':
                        insert_dic_data(filter_params, 'first_name__icontains', value)

                    elif filter_name == 'email':
                        insert_dic_data(filter_params, 'email__icontains', value)

                    elif filter_name == 'is_active':
                        insert_dic_data(filter_params, 'is_active', value)

            data_cols_args = ['id', 'is_superuser', 'username', 'first_name', 'email', 'is_active']
            data_cols_kwargs = dict(
                _last_login=Cast(TruncSecond('last_login', DateTimeField()), CharField()),
                _date_joined=Cast(TruncSecond('date_joined', DateTimeField()), CharField()),
            )
            val = list(User.objects.values(
                *data_cols_args, **data_cols_kwargs).filter(**filter_params).order_by(ordering)[limit_start:limit_end])

            # 전체 레코드 수 조회
            records_total = User.objects.filter(**filter_params).count()

            return JsonResponse(
                {'draw': draw, 'recordsTotal': records_total, 'recordsFiltered': records_total, 'data': val,
                 'user_id': user_id})

        except Exception as e:
            logger.warning(f'[UsersAPI - get] {to_str(e)}')
            return HttpResponse(status=400)

    @method_decorator(permission_required('kms.add_user', raise_exception=True))
    def post(self, request):
        # 감사 로그 > 내용
        actions = []

        # 감사 로그 > 결과
        result = False
        try:
            username = get_dic_value(request.POST, 'username')
            password = get_dic_value(request.POST, 'password')
            is_superuser = get_dic_value(request.POST, 'is_superuser')
            first_name = get_dic_value(request.POST, 'first_name')
            email = get_dic_value(request.POST, 'email')
            is_active = get_dic_value(request.POST, 'is_active')

            # 비밀번호가 8자 미만이거나 120자 초과하는 경우
            if 8 > password.__len__() > 120:
                return HttpResponse(status=400)

            # 사용할 수 없는 문자가 포함된 경우
            if invalid_char_regex.findall(username):
                return HttpResponse(status=422)

            try:
                # 비밀번호 유효성 검증
                password_validation.validate_password(password=password)

            # 비밀번호 유효성 검증 오류 발생 시 오류 메시지 반환
            except ValidationError as e:
                logger.error(f'[users_api] {e.messages[0]}')
                return JsonResponse({'error': e.messages[0]})

            # DB에 데이터 추가
            user = User.objects.create_user(
                username=username,
                password=password,
                is_superuser=is_superuser,
                first_name=first_name,
                email=email,
                is_active=is_active,
                date_joined=datetime.now().strftime('%Y-%m-%d %H:%M:%S')
            )
            user.save()

            # 추가 성공 시 감사 로그 > 내용에 아이디 항목 추가
            actions.append(f'[아이디] : {to_str(user.id)}')

            # 사용자 그룹 추가
            group_name = '관리자' if is_superuser == 1 else '사용자'
            group = Group.objects.get(name=group_name)
            group.user_set.add(user)
            group.save()

            result = True
            return HttpResponse(status=201)

        except Exception as e:
            logger.warning(f'[UsersAPI - post] {to_str(e)}')
            return HttpResponse(status=400)

        finally:
            user_type = '관리자' if is_superuser == '1' else '사용자'
            active = '활성' if is_active == '1' else '비활성'
            # 감사 로그 기록
            actions.append(f'[사용자 아이디] : {username}')
            actions.append(f'[유형] : {user_type}')
            actions.append(f'[이름] : {first_name}')
            actions.append(f'[이메일] : {email}')
            actions.append(f'[활성화] : {active}')
            audit_log = f"""추가 ( {', '.join(actions)} )"""

            insert_audit_log(request.user.id, request, category, '사용자 관리', audit_log, result)

    @method_decorator(permission_required('kms.change_user', raise_exception=True))
    def put(self, request, req_id):
        user_id = request.user.id

        # 감사 로그 > 내용
        actions = []
        actions.append(f'[아이디] : {to_str(req_id)}')

        # 감사 로그 > 결과
        result = False
        try:
            if req_id:

                # put data 파싱
                put_data = MultiPartParser(request.META, request, request.upload_handlers).parse()[0]
                password = get_dic_value(put_data, 'password')
                is_superuser = get_dic_value(put_data, 'is_superuser')
                first_name = get_dic_value(put_data, 'first_name')
                email = get_dic_value(put_data, 'email')
                is_active = get_dic_value(put_data, 'is_active')

                # 비밀번호가 8자 미만이거나 120자 초과하는 경우
                if 8 > password.__len__() > 120:
                    return HttpResponse(status=400)

                # id 기준으로 항목 조회
                data = User.objects.get(pk=to_int(req_id))

                actions.append(f'[사용자 아이디] : {to_str(data.username)}')

                if user_id != to_int(req_id) and to_str(data.is_superuser) != is_superuser:
                    org_user_type = '관리자' if data.is_superuser == 1 else '사용자'
                    user_type = '관리자' if is_superuser == '1' else '사용자'

                    # 감사 로그 > 내용 추가
                    actions.append(f'[유형] : {org_user_type} → {user_type}')

                    # 항목 수정
                    data.is_superuser = is_superuser

                if data.first_name != first_name:
                    # 감사 로그 > 내용 추가
                    actions.append(f'[이름] : {to_str(data.first_name)} → {first_name}')

                    # 항목 수정
                    data.first_name = first_name

                if data.email != email:
                    # 감사 로그 > 내용 추가
                    actions.append(f'[이메일] : {to_str(data.email)} → {email}')

                    # 항목 수정
                    data.email = email

                if user_id != to_int(req_id) and to_str(data.is_active) != is_active:
                    org_active = '활성' if data.is_active == 1 else '비활성'
                    active = '활성' if is_active == '1' else '비활성'

                    # 감사 로그 > 내용 추가
                    actions.append(f'[활성화] : {org_active} → {active}')

                    # 항목 수정
                    data.is_active = is_active

                # 변경 사항 적용
                data.save()

                # 패스워드 변경
                if user_id != to_int(req_id) and password != '':
                    user = User.objects.get(pk=to_int(req_id))
                    actions.append(f'[패스워드 변경]')

                    try:
                        # 비밀번호 유효성 검증
                        password_validation.validate_password(password=password)

                        user.set_password(password)

                        # 변경 사항 적용
                        user.save()

                    # 비밀번호 유효성 검증 오류 발생 시 오류 메시지 반환
                    except ValidationError as e:
                        logger.error(f'[UsersAPI - put] {e.messages[0]}')
                        return JsonResponse({'error': e.messages[0]})

                # 기존 그룹 모두 삭제
                data.groups.clear()

                group_name = 'Admin' if to_int(data.is_superuser) == 1 else 'User'
                group = Group.objects.get(name=group_name)
                group.user_set.add(data)
                group.save()

                result = True

                return HttpResponse(status=204)

        except Exception as e:
            logger.warning(f'[UsersAPI - put] {to_str(e)}')
            return HttpResponse(status=400)

        finally:
            # 감사 로그 기록
            audit_log = f"""편집 ( {', '.join(actions)} )"""
            insert_audit_log(request.user.id, request, category, '사용자 관리', audit_log, result)


# 그룹 명으로 그룹 id 조회
def get_group_id_by_name(group_name):
    result = None

    try:
        if models.AuthGroup.objects.values().filter(name=group_name):
            group_obj = models.AuthGroup.objects.get(name=group_name)
            result = to_int(group_obj.id)

    except Exception as e:
        logger.warning(f'[get_group_id_by_name] {to_str(e)}')

    finally:
        return result


class CheckUserAPI(View):
    @method_decorator(permission_required('kms.view_user', raise_exception=True))
    def get(self, request, username):
        try:
            result = False
            if User.objects.filter(username=username):
                result = True

            return JsonResponse({'data': result})

        except Exception as e:
            logger.warning(f'[CheckUserAPI - get] {to_str(e)}')
            return HttpResponse(status=400)


# 토큰 관리
class TokenView(TemplateView):
    template_name = 'kms/account/token.html'
    context = {}

    def get(self, request, *args, **kwargs):
        # 필터 설정
        filter_params = {}
        insert_dic_data(filter_params, 'is_active', 1)
        insert_dic_data(filter_params, 'auth_token__isnull', True)

        data_cols_args = ['id', 'username']
        self.context['tokenless_user_list'] = list(
            User.objects.values(*data_cols_args).filter(**filter_params).order_by('username'))

        return self.render_to_response(self.context)


class TokenAPI(View):
    @method_decorator(permission_required('kms.view_token', raise_exception=True))
    def get(self, request):
        try:
            # 컬럼 리스트
            column_list = ('user_id__username', 'key', 'created')

            # 정렬 설정
            ordering = '-created'  # 기본 값 : 생성 일자 (최신) 기준

            # LIMIT 시작 인덱스
            limit_start = 0

            # LIMIT 종료 인덱스
            limit_end = None

            # 필터 설정
            filter_params = {}

            # LIMIT 및 필터 설정
            for param in request.GET.items():
                key = param[0]
                value = param[1]

                # LIMIT 시작 인덱스
                if key == 'start':
                    limit_start = to_int(value)

                # LIMIT 종료 인덱스
                elif key == 'length' and to_int(value) > -1:
                    limit_end = limit_start + to_int(value)

                # XSS 방지를 위한 파라미터
                elif key == 'draw':
                    draw = value

                # 정렬 설정
                elif key == 'order[order]':
                    req_ordering = value
                    req_order_dir = request.GET.get('order[dir]')

                    # audit_date가 입력된 경우 실제 필드인 date로 치환
                    if req_ordering == 'created_date':
                        req_ordering = 'created'

                    if req_ordering in column_list:
                        ordering = req_order_dir + req_ordering

                # 필터 설정
                elif table_filter_regex.search(key) and value != '':
                    filter_key = f'{key.split("[value]")[0]}[data]'
                    filter_name = get_dic_value(request.GET, filter_key)

                    # 사용자
                    if filter_name == 'user_id__username':
                        insert_dic_data(filter_params, 'user_id__username__icontains', value)

                    # 토큰
                    elif filter_name == 'key':
                        insert_dic_data(filter_params, 'key__icontains', value)

            val = list(Token.objects.values(
                'user_id__username', 'key', created_date=Cast(TruncSecond('created', DateTimeField()), CharField())
            ).filter(**filter_params).order_by(ordering)[limit_start:limit_end])

            # 전체 레코드 수 조회
            records_total = Token.objects.filter(**filter_params).count()

            return JsonResponse(
                {'draw': draw, 'recordsTotal': records_total, 'recordsFiltered': records_total, 'data': val})

        except Exception as e:
            logger.warning(f'[TokenAPI - get] {to_str(e)}')
            return HttpResponse(status=400)

    @method_decorator(permission_required('kms.add_token', raise_exception=True))
    def post(self, request):
        # 감사 로그 > 내용
        actions = []

        # 감사 로그 > 결과
        result = False
        username = ''

        try:
            user_id = to_int(get_dic_value(request.POST, 'user'))
            # 일치하는 사용자 계정이 존재하는 경우
            if User.objects.values().filter(id=user_id):
                user = User.objects.get(id=user_id)
                username = user.username

                # 토큰 추가 수행
                Token.objects.get_or_create(user=user)
                result = True
            else:
                return HttpResponse(status=400)

            return HttpResponse(status=201)

        except Exception as e:
            logger.warning(f'[TokenAPI - post] {to_str(e)}')
            return HttpResponse(status=400)

        finally:
            # 감사 로그 기록
            actions.append(f'[사용자] : {username}')
            audit_log = f"""추가 ( {', '.join(actions)} )"""

            insert_audit_log(request.user.id, request, category, '토큰 관리', audit_log, result)

    @method_decorator(permission_required('kms.delete_token', raise_exception=True))
    def delete(self, request, req_key):
        # 감사 로그 > 내용
        actions = []

        # 감사 로그 > 결과
        result = False
        username = ''
        empty_param = False
        pw_fail = False

        try:
            # 패스워드 파라미터가 존재하는 경우
            if req_key and request.body and json.loads(request.body) and json.loads(request.body).get('user_data'):
                user_data = json.loads(request.body).get('user_data')
                username = json.loads(request.body).get('username')

                # 입력한 패스워드가 일치하는 경우
                if check_password(user_data, request.user.password):
                    # 삭제할 토큰 조회
                    if Token.objects.filter(pk=to_str(req_key)):
                        token_data = Token.objects.get(pk=to_str(req_key))
                        username = to_str(token_data.user.username)

                        # 토큰 삭제 수행
                        token_data.delete()
                        result = True
                        return HttpResponse(status=204)

                    else:
                        return HttpResponse(status=409)

                # 입력한 패스워드가 일치하지 않은 경우
                else:
                    # 감사 로그에 비밀번호 불일치 메시지를 추가하기 위함
                    pw_fail = True
                    return HttpResponse(status=401)

            # 패스워드 파라미터가 존재하지 않는 경우
            else:
                return HttpResponse(status=400)

        except Exception as e:
            logger.warning(f'[TokenAPI - delete] {to_str(e)}')
            return HttpResponse(status=400)

        finally:
            # 감사 로그 기록
            actions.append(f'[사용자] : {username}')

            # 필수 파라미터 누락 메시지 추가
            if empty_param is True:
                actions.append(f'필수 파라미터 누락')

            # 비밀번호 불일치 메시지 추가
            if pw_fail is True:
                actions.append(f'비밀번호 불일치')

            audit_log = f"""삭제 ( {', '.join(actions)} )"""
            insert_audit_log(request.user.id, request, category, '토큰 관리', audit_log, result)
