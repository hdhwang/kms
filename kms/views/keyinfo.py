import json
import logging
from datetime import datetime

from django.conf import settings
from django.contrib.auth.decorators import permission_required
from django.contrib.auth.hashers import check_password
from django.contrib.auth.models import User
from django.db.models import CharField, DateTimeField
from django.db.models.functions import Cast, TruncSecond
from django.http import JsonResponse, HttpResponse
from django.http.multipartparser import MultiPartParser
from django.utils.decorators import method_decorator
from django.views.generic import TemplateView, View

from kms import models
from utils.aes_helper import AESCipher
from utils.dic_helper import insert_dic_data, get_dic_value
from utils.format_helper import to_int, to_str
from utils.log_helper import insert_audit_log
from utils.regex_helper import table_filter_regex, invalid_char_regex

logger = logging.getLogger(__name__)


# 감사 로그 > 카테고리
category = "키 관리"


# 키 관리
class KeyInfoView(TemplateView):
    template_name = "kms/keyinfo/user.html"
    context = {}

    def get(self, request, *args, **kwargs):
        if request.user.is_superuser:
            self.template_name = "kms/keyinfo/admin.html"
            data_cols_args = ["id", "username", "is_active"]
            self.context["user_list"] = list(
                User.objects.values(*data_cols_args).order_by("username")
            )

        return self.render_to_response(self.context)


class UserAPI(View):
    @method_decorator(permission_required("kms.view_keyinfo", raise_exception=True))
    def get(self, request):
        try:
            # 컬럼 리스트
            column_list = ("key", "description", "created_date")

            # 정렬 설정
            ordering = "-created_date"  # 기본 값 : 일자 (최신) 기준

            # LIMIT 시작 인덱스
            limit_start = 0

            # LIMIT 종료 인덱스
            limit_end = None

            # 필터 설정
            filter_params = {}
            insert_dic_data(filter_params, "user_id", request.user.id)

            # LIMIT 및 필터 설정
            for param in request.GET.items():
                key = param[0]
                value = param[1]

                # LIMIT 시작 인덱스
                if key == "start":
                    limit_start = to_int(value)

                # LIMIT 종료 인덱스
                elif key == "length" and to_int(value) > -1:
                    limit_end = limit_start + to_int(value)

                # XSS 방지를 위한 파라미터
                elif key == "draw":
                    draw = value

                # 정렬 설정
                elif key == "order[order]":
                    req_ordering = value
                    req_order_dir = request.GET.get("order[dir]")

                    # date가 입력된 경우 실제 필드인 created_date로 치환
                    if req_ordering == "date":
                        req_ordering = "created_date"

                    if req_ordering in column_list:
                        ordering = req_order_dir + req_ordering

                # 필터 설정
                elif table_filter_regex.search(key) and value != "":
                    filter_key = f'{key.split("[value]")[0]}[data]'
                    filter_name = get_dic_value(request.GET, filter_key)

                    # 키
                    if filter_name == "key":
                        insert_dic_data(filter_params, "key__icontains", value)

                    # 설명
                    elif filter_name == "description":
                        insert_dic_data(filter_params, "description__icontains", value)

            data_cols_args = ["key", "description"]
            data_cols_kwargs = dict(
                date=Cast(TruncSecond("created_date", DateTimeField()), CharField())
            )
            val = list(
                models.Keyinfo.objects.values(*data_cols_args, **data_cols_kwargs)
                .filter(**filter_params)
                .order_by(ordering)[limit_start:limit_end]
            )

            # 전체 레코드 수 조회
            records_total = models.Keyinfo.objects.filter(**filter_params).count()

            return JsonResponse(
                {
                    "draw": draw,
                    "recordsTotal": records_total,
                    "recordsFiltered": records_total,
                    "data": val,
                }
            )

        except Exception as e:
            logger.warning(f"[UserAPI - get] {to_str(e)}")
            return HttpResponse(status=400)

    @method_decorator(permission_required("kms.add_keyinfo", raise_exception=True))
    def post(self, request):
        # 감사 로그 > 내용
        actions = []

        # 감사 로그 > 결과
        result = False

        try:
            key = get_dic_value(request.POST, "key")
            value = get_dic_value(request.POST, "value")
            description = get_dic_value(request.POST, "description")

            # 사용할 수 없는 문자가 포함된 경우
            if invalid_char_regex.findall(key):
                return HttpResponse(status=422)

            # 키 값 암호화 수행
            enc_value = make_enc_value(value)

            # DB에 데이터 추가
            models.Keyinfo.objects.create(
                user_id=request.user.id,
                key=key,
                value=enc_value,
                description=description,
                created_date=datetime.now(),
            )
            result = True

            return HttpResponse(status=201)

        except Exception as e:
            logger.warning(f"[UserAPI - post] {to_str(e)}")
            return HttpResponse(status=400)

        finally:
            # 감사 로그 기록
            description_str = description if description else None
            actions.append(f"[키] : {key}")
            actions.append(f"[설명] : {description_str}")
            audit_log = f"""추가 ( {', '.join(actions)} )"""

            insert_audit_log(
                request.user.username, request, category, "사용자", audit_log, result
            )

    @method_decorator(permission_required("kms.change_keyinfo", raise_exception=True))
    def put(self, request, key):
        # 감사 로그 > 내용
        actions = []
        actions.append(f"[키] : {key}")

        # 감사 로그 > 결과
        result = False

        try:
            if key:
                # put data 파싱
                put_data = MultiPartParser(
                    request.META, request, request.upload_handlers
                ).parse()[0]
                description = get_dic_value(put_data, "description")

                # 사용자 아이디, key 기준으로 키 조회
                if models.Keyinfo.objects.filter(user_id=request.user.id, key=key):
                    keyinfo_data = models.Keyinfo.objects.get(
                        user_id=request.user.id, key=key
                    )

                    if keyinfo_data.description != description:
                        # 감사 로그 > 내용 추가
                        description_str = description if description else None
                        actions.append(
                            f"[설명] : {to_str(keyinfo_data.description)} → {description_str}"
                        )

                        # 항목 수정
                        models.Keyinfo.objects.filter(
                            user_id=request.user.id, key=key
                        ).update(description=description)

                    result = True
                    return HttpResponse(status=204)
                else:
                    return HttpResponse(status=409)

        except Exception as e:
            logger.warning(f"[UserAPI - put] {to_str(e)}")
            return HttpResponse(status=400)

        finally:
            # 감사 로그 기록
            audit_log = f"""편집 ( {', '.join(actions)} )"""
            insert_audit_log(
                request.user.username, request, category, "사용자", audit_log, result
            )

    @method_decorator(permission_required("kms.delete_keyinfo", raise_exception=True))
    def delete(self, request, key):
        # 감사 로그 > 내용
        actions = []

        # 감사 로그 > 결과
        result = False
        description_str = None
        do_not_write_log = False
        pw_fail = False

        try:
            if key:
                # DB에서 키 삭제 시 패스워드 입력 요구 조회
                req_pw = get_keyinfo_settings_value("REQ_PW_KEYINFO_DELETE")

                # 패스워드 입력이 필요한 경우
                if req_pw == "Y":
                    if request.body:
                        resp_body = json.loads(request.body)

                        # 패스워드 파라미터가 존재하는 경우
                        if resp_body and resp_body.get("user_data"):
                            user_data = resp_body.get("user_data")

                            # 입력한 패스워드가 일치하는 경우
                            if check_password(user_data, request.user.password):
                                # 사용자 아이디, key 기준으로 삭제할 키 조회
                                if models.Keyinfo.objects.filter(
                                    user_id=request.user.id, key=key
                                ):
                                    keyinfo_data = models.Keyinfo.objects.get(
                                        user_id=request.user.id, key=key
                                    )
                                    description = to_str(keyinfo_data.description)
                                    description_str = (
                                        description if description else None
                                    )

                                    # 키 삭제 수행
                                    models.Keyinfo.objects.filter(
                                        user_id=request.user.id, key=key
                                    ).delete()

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
                            # 패스워드 입력 요청 리턴 시 요청에 대한 감사 로그 기록을 하지 않음
                            do_not_write_log = True
                            return HttpResponse(status=400)

                    else:
                        # 패스워드 입력 요청 리턴 시 요청에 대한 감사 로그 기록을 하지 않음
                        do_not_write_log = True
                        return HttpResponse(status=400)

                # 패스워드 입력이 필요하지 않은 경우
                else:
                    # 사용자 아이디, key 기준으로 삭제할 키 조회
                    if models.Keyinfo.objects.filter(user_id=request.user.id, key=key):
                        keyinfo_data = models.Keyinfo.objects.get(
                            user_id=request.user.id, key=key
                        )
                        description = to_str(keyinfo_data.description)
                        description_str = description if description else None

                        # 키 삭제 수행
                        models.Keyinfo.objects.filter(
                            user_id=request.user.id, key=key
                        ).delete()

                        result = True
                        return HttpResponse(status=204)
                    else:
                        return HttpResponse(status=409)

        except Exception as e:
            logger.warning(f"[UserAPI - delete] {to_str(e)}")
            return HttpResponse(status=400)

        finally:
            if do_not_write_log is False:
                # 감사 로그 기록
                actions.append(f"[키] : {key}")
                actions.append(f"[설명] : {description_str}")

                # 비밀번호 불일치 메시지 추가
                if pw_fail is True:
                    actions.append(f"비밀번호 불일치")

                audit_log = f"""삭제 ( {', '.join(actions)} )"""

                insert_audit_log(
                    request.user.username, request, category, "사용자", audit_log, result
                )


# 키 값 암호화 수행
def make_enc_value(value):
    result = value

    try:
        key = getattr(settings, "AES_KEY")
        iv = getattr(settings, "AES_KEY_IV")
        aes = AESCipher(key, iv)

        result = aes.encrypt(value)

    except Exception as e:
        logger.warning(f"[make_enc_value] {to_str(e)}")

    finally:
        return result


# 키 값 복호화 수행
def get_dec_value(enc_value):
    result = enc_value

    try:
        key = getattr(settings, "AES_KEY")
        iv = getattr(settings, "AES_KEY_IV")
        aes = AESCipher(key, iv)

        result = aes.decrypt(enc_value)

    except Exception as e:
        logger.warning(f"[get_dec_value] {to_str(e)}")

    finally:
        return result


# 사용자 키 중복 확인
class CheckKeyUserAPI(View):
    @method_decorator(permission_required("kms.view_keyinfo", raise_exception=True))
    def post(self, request):
        try:
            result = False
            key = get_dic_value(request.POST, "key")

            # 사용할 수 없는 문자가 포함된 경우
            if invalid_char_regex.findall(key):
                return HttpResponse(status=422)

            if models.Keyinfo.objects.filter(user_id=request.user.id, key=key):
                result = True

            return JsonResponse({"data": result})

        except Exception as e:
            logger.warning(f"[CheckKeyUserAPI - post] {to_str(e)}")
            return HttpResponse(status=400)


# 사용자 키 값 조회
class ValueUserAPI(View):
    @method_decorator(permission_required("kms.view_keyinfo", raise_exception=True))
    def post(self, request):
        # 감사 로그 > 내용
        actions = []

        # 감사 로그 > 결과
        result = False
        do_not_write_log = False
        pw_fail = False
        key = None

        try:
            key = get_dic_value(request.POST, "key")

            if key:
                # DB에서 키 상세 조회 시 패스워드 입력 요구 조회
                req_pw = get_keyinfo_settings_value("REQ_PW_KEYINFO_VALUE")

                # 패스워드 입력이 필요한 경우
                if req_pw == "Y":
                    user_data = get_dic_value(request.POST, "user_data")

                    # 패스워드 파라미터가 존재하는 경우
                    if user_data:
                        # 입력한 패스워드가 일치하는 경우
                        if check_password(user_data, request.user.password):
                            if models.Keyinfo.objects.filter(
                                user_id=request.user.id, key=key
                            ):
                                value = models.Keyinfo.objects.get(
                                    user_id=request.user.id, key=key
                                ).value
                                dec_value = get_dec_value(value)
                                result = True
                                return JsonResponse({"data": dec_value})
                            else:
                                return HttpResponse(status=409)

                        # 입력한 패스워드가 일치하지 않은 경우
                        else:
                            # 감사 로그에 비밀번호 불일치 메시지를 추가하기 위함
                            pw_fail = True
                            return HttpResponse(status=401)

                    # 패스워드 파라미터가 존재하지 않는 경우
                    else:
                        # 패스워드 입력 요청 리턴 시 요청에 대한 감사 로그 기록을 하지 않음
                        do_not_write_log = True
                        return HttpResponse(status=400)

                # 패스워드 입력이 필요하지 않은 경우
                else:
                    if models.Keyinfo.objects.filter(user_id=request.user.id, key=key):
                        value = models.Keyinfo.objects.get(
                            user_id=request.user.id, key=key
                        ).value
                        dec_value = get_dec_value(value)
                        result = True
                        return JsonResponse({"data": dec_value})
                    else:
                        return HttpResponse(status=409)

        except Exception as e:
            logger.warning(f"[ValueUserAPI - post] {to_str(e)}")
            return HttpResponse(status=400)

        finally:
            if do_not_write_log is False:
                # 감사 로그 기록
                actions.append(f"[키] : {key}")

                # 비밀번호 불일치 메시지 추가
                if pw_fail is True:
                    actions.append(f"비밀번호 불일치")

                audit_log = f"""키 값 조회 ( {', '.join(actions)} )"""
                insert_audit_log(
                    request.user.username, request, category, "사용자", audit_log, result
                )


class AdminAPI(View):
    @method_decorator(permission_required("kms.view_keyinfo", raise_exception=True))
    def get(self, request):
        # 관리자 권한이 아닌 경우 403 리턴
        if request.user.is_superuser is False:
            return HttpResponse(status=403)

        try:
            # 컬럼 리스트
            column_list = (
                "user_id",
                "user_id__username",
                "key",
                "value",
                "description",
                "created_date",
            )

            # 정렬 설정
            ordering = "-created_date"  # 기본 값 : 일자 (최신) 기준

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
                if key == "start":
                    limit_start = to_int(value)

                # LIMIT 종료 인덱스
                elif key == "length" and to_int(value) > -1:
                    limit_end = limit_start + to_int(value)

                # XSS 방지를 위한 파라미터
                elif key == "draw":
                    draw = value

                # 정렬 설정
                elif key == "order[order]":
                    req_ordering = value
                    req_order_dir = request.GET.get("order[dir]")

                    # date가 입력된 경우 실제 필드인 created_date로 치환
                    if req_ordering == "date":
                        req_ordering = "created_date"

                    if req_ordering in column_list:
                        ordering = req_order_dir + req_ordering

                # 필터 설정
                elif table_filter_regex.search(key) and value != "":
                    filter_key = f'{key.split("[value]")[0]}[data]'
                    filter_name = get_dic_value(request.GET, filter_key)

                    # 사용자
                    if filter_name == "user_id__username":
                        insert_dic_data(
                            filter_params, "user_id__username__icontains", value
                        )

                    # 키
                    elif filter_name == "key":
                        insert_dic_data(filter_params, "key__icontains", value)

                    # 설명
                    elif filter_name == "description":
                        insert_dic_data(filter_params, "description__icontains", value)

            data_cols_args = [
                "user_id",
                "user_id__username",
                "key",
                "value",
                "description",
            ]
            data_cols_kwargs = dict(
                date=Cast(TruncSecond("created_date", DateTimeField()), CharField())
            )
            val = list(
                models.Keyinfo.objects.values(*data_cols_args, **data_cols_kwargs)
                .filter(**filter_params)
                .order_by(ordering)[limit_start:limit_end]
            )

            # 전체 레코드 수 조회
            records_total = models.Keyinfo.objects.filter(**filter_params).count()

            return JsonResponse(
                {
                    "draw": draw,
                    "recordsTotal": records_total,
                    "recordsFiltered": records_total,
                    "data": val,
                }
            )

        except Exception as e:
            logger.warning(f"[AdminAPI - get] {to_str(e)}")
            return HttpResponse(status=400)

    @method_decorator(permission_required("kms.add_keyinfo", raise_exception=True))
    def post(self, request):
        # 관리자 권한이 아닌 경우 403 리턴
        if request.user.is_superuser is False:
            return HttpResponse(status=403)

        # 감사 로그 > 내용
        actions = []

        # 감사 로그 > 결과
        result = False
        username = None

        try:
            user = get_dic_value(request.POST, "user")
            key = get_dic_value(request.POST, "key")
            value = get_dic_value(request.POST, "value")
            description = get_dic_value(request.POST, "description")

            # 사용할 수 없는 문자가 포함된 경우
            if invalid_char_regex.findall(key):
                return HttpResponse(status=422)

            if User.objects.filter(pk=to_int(user)):
                user_obj = User.objects.get(pk=to_int(user))
                username = user_obj.username

                # 키 값 암호화 수행
                enc_value = make_enc_value(value)

                # DB에 데이터 추가
                models.Keyinfo.objects.create(
                    user_id=user_obj.id,
                    key=key,
                    value=enc_value,
                    description=description,
                    created_date=datetime.now(),
                )
                result = True
                return HttpResponse(status=201)

        except Exception as e:
            logger.warning(f"[AdminAPI - post] {to_str(e)}")
            return HttpResponse(status=400)

        finally:
            # 감사 로그 기록
            description_str = description if description else None
            actions.append(f"[사용자] : {username}")
            actions.append(f"[키] : {key}")
            actions.append(f"[설명] : {description_str}")
            audit_log = f"""추가 ( {', '.join(actions)} )"""

            insert_audit_log(
                request.user.username, request, category, "관리자", audit_log, result
            )

    @method_decorator(permission_required("kms.change_keyinfo", raise_exception=True))
    def put(self, request, key):
        # 관리자 권한이 아닌 경우 403 리턴
        if request.user.is_superuser is False:
            return HttpResponse(status=403)

        # 감사 로그 > 내용
        actions = []
        actions.append(f"[키] : {key}")

        # 감사 로그 > 결과
        result = False

        try:
            if key:
                # put data 파싱
                put_data = MultiPartParser(
                    request.META, request, request.upload_handlers
                ).parse()[0]
                user = get_dic_value(put_data, "user")
                description = get_dic_value(put_data, "description")

                if User.objects.filter(pk=to_int(user)):
                    user_obj = User.objects.get(pk=to_int(user))
                    actions.append(f"[사용자] : {user_obj.username}")

                    # 사용자 아이디, key 기준으로 키 조회
                    if models.Keyinfo.objects.filter(user_id=user_obj.id, key=key):
                        keyinfo_data = models.Keyinfo.objects.get(
                            user_id=user_obj.id, key=key
                        )

                        if keyinfo_data.description != description:
                            # 감사 로그 > 내용 추가
                            description_str = description if description else None
                            actions.append(
                                f"[설명] : {to_str(keyinfo_data.description)} → {description_str}"
                            )

                            # 항목 수정
                            models.Keyinfo.objects.filter(
                                user_id=user_obj.id, key=key
                            ).update(description=description)

                        result = True
                        return HttpResponse(status=204)
                    else:
                        return HttpResponse(status=409)

        except Exception as e:
            logger.warning(f"[AdminAPI - put] {to_str(e)}")
            return HttpResponse(status=400)

        finally:
            # 감사 로그 기록
            audit_log = f"""편집 ( {', '.join(actions)} )"""
            insert_audit_log(
                request.user.username, request, category, "사용자", audit_log, result
            )

    @method_decorator(permission_required("kms.delete_keyinfo", raise_exception=True))
    def delete(self, request, key):
        # 관리자 권한이 아닌 경우 403 리턴
        if request.user.is_superuser is False:
            return HttpResponse(status=403)

        # 감사 로그 > 내용
        actions = []

        # 감사 로그 > 결과
        result = False
        username = None
        description_str = None
        do_not_write_log = False
        pw_fail = False

        try:
            if (
                key
                and request.body
                and json.loads(request.body)
                and json.loads(request.body).get("user_id")
            ):
                resp_body = json.loads(request.body)
                user_id = resp_body.get("user_id")

                if User.objects.filter(pk=to_int(user_id)) and key:
                    user_obj = User.objects.get(pk=to_int(user_id))
                    username = user_obj.username

                    # DB에서 키 삭제 시 패스워드 입력 요구 조회
                    req_pw = get_keyinfo_settings_value("REQ_PW_KEYINFO_DELETE")

                    # 패스워드 입력이 필요한 경우
                    if req_pw == "Y":
                        # 패스워드 파라미터가 존재하는 경우
                        if resp_body.get("user_data"):
                            user_data = resp_body.get("user_data")

                            # 입력한 패스워드가 일치하는 경우
                            if check_password(user_data, request.user.password):
                                # 사용자 아이디, key 기준으로 삭제할 키 조회
                                if models.Keyinfo.objects.filter(
                                    user_id=user_obj.id, key=key
                                ):
                                    keyinfo_data = models.Keyinfo.objects.get(
                                        user_id=user_obj.id, key=key
                                    )
                                    description = to_str(keyinfo_data.description)
                                    description_str = (
                                        description if description else None
                                    )

                                    # 키 삭제 수행
                                    models.Keyinfo.objects.filter(
                                        user_id=user_obj.id, key=key
                                    ).delete()

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
                            # 패스워드 입력 요청 리턴 시 요청에 대한 감사 로그 기록을 하지 않음
                            do_not_write_log = True
                            return HttpResponse(status=400)

                    # 패스워드 입력이 필요하지 않은 경우
                    else:
                        # 사용자 아이디, key 기준으로 삭제할 키 조회
                        if models.Keyinfo.objects.filter(user_id=user_obj.id, key=key):
                            keyinfo_data = models.Keyinfo.objects.get(
                                user_id=user_obj.id, key=key
                            )
                            description = to_str(keyinfo_data.description)
                            description_str = description if description else None

                            # 키 삭제 수행
                            models.Keyinfo.objects.filter(
                                user_id=user_obj.id, key=key
                            ).delete()

                            result = True
                            return HttpResponse(status=204)
                        else:
                            return HttpResponse(status=409)

        except Exception as e:
            logger.warning(f"[AdminAPI - delete] {to_str(e)}")
            return HttpResponse(status=400)

        finally:
            if do_not_write_log is False:
                # 감사 로그 기록
                actions.append(f"[사용자] : {username}")
                actions.append(f"[키] : {key}")
                actions.append(f"[설명] : {description_str}")

                # 비밀번호 불일치 메시지 추가
                if pw_fail is True:
                    actions.append(f"비밀번호 불일치")

                audit_log = f"""삭제 ( {', '.join(actions)} )"""
                insert_audit_log(
                    request.user.username, request, category, "관리자", audit_log, result
                )


# 사용자 키 중복 확인 (관리자)
class CheckKeyAdminAPI(View):
    @method_decorator(permission_required("kms.view_keyinfo", raise_exception=True))
    def post(self, request):
        try:
            # 관리자 권한이 아닌 경우 403 리턴
            if request.user.is_superuser is False:
                return HttpResponse(status=403)

            result = False
            key = get_dic_value(request.POST, "key")
            user = get_dic_value(request.POST, "user")

            # 사용할 수 없는 문자가 포함된 경우
            if invalid_char_regex.findall(key):
                return HttpResponse(status=422)

            if User.objects.filter(pk=to_int(user)):
                user_obj = User.objects.get(pk=to_int(user))
                if models.Keyinfo.objects.filter(user_id=user_obj.id, key=key):
                    result = True

            return JsonResponse({"data": result})

        except Exception as e:
            logger.warning(f"[CheckKeyAdminAPI - post] {to_str(e)}")
            return HttpResponse(status=400)


# 사용자 키 값 조회 (관리자)
class ValueAdminAPI(View):
    @method_decorator(permission_required("kms.view_keyinfo", raise_exception=True))
    def post(self, request):
        # 관리자 권한이 아닌 경우 403 리턴
        if request.user.is_superuser is False:
            return HttpResponse(status=403)

        result = False
        do_not_write_log = False
        pw_fail = False
        username = None
        key = None

        try:
            user_id = get_dic_value(request.POST, "user_id")
            key = get_dic_value(request.POST, "key")

            if User.objects.filter(pk=to_int(user_id)) and key:
                user_obj = User.objects.get(pk=to_int(user_id))
                username = user_obj.username

                # DB에서 키 상세 조회 시 패스워드 입력 요구 조회
                req_pw = get_keyinfo_settings_value("REQ_PW_KEYINFO_VALUE")

                # 패스워드 입력이 필요한 경우
                if req_pw == "Y":
                    user_data = get_dic_value(request.POST, "user_data")

                    # 패스워드 파라미터가 존재하는 경우
                    if user_data:
                        # 입력한 패스워드가 일치하는 경우
                        if check_password(user_data, request.user.password):
                            if models.Keyinfo.objects.filter(
                                user_id=user_obj.id, key=key
                            ):
                                value = models.Keyinfo.objects.get(
                                    user_id=user_obj.id, key=key
                                ).value
                                dec_value = get_dec_value(value)
                                result = True
                                return JsonResponse(
                                    {"username": username, "data": dec_value}
                                )
                            else:
                                return HttpResponse(status=409)

                        # 입력한 패스워드가 일치하지 않은 경우
                        else:
                            # 감사 로그에 비밀번호 불일치 메시지를 추가하기 위함
                            pw_fail = True
                            return HttpResponse(status=401)

                    # 패스워드 파라미터가 존재하지 않는 경우
                    else:
                        # 패스워드 입력 요청 리턴 시 요청에 대한 감사 로그 기록을 하지 않음
                        do_not_write_log = True
                        return HttpResponse(status=400)

                # 패스워드 입력이 필요하지 않은 경우
                else:
                    if models.Keyinfo.objects.filter(user_id=user_obj.id, key=key):
                        value = models.Keyinfo.objects.get(
                            user_id=user_obj.id, key=key
                        ).value
                        dec_value = get_dec_value(value)
                        result = True
                        return JsonResponse({"username": username, "data": dec_value})
                    else:
                        return HttpResponse(status=409)

        except Exception as e:
            logger.warning(f"[ValueAdminAPI - post] {to_str(e)}")
            return HttpResponse(status=400)

        finally:
            if do_not_write_log is False:
                # 감사 로그 기록
                actions = []
                actions.append(f"[사용자] : {username}")
                actions.append(f"[키] : {key}")

                # 비밀번호 불일치 메시지 추가
                if pw_fail is True:
                    actions.append(f"비밀번호 불일치")

                audit_log = f"""키 값 조회 ( {', '.join(actions)} )"""

                insert_audit_log(
                    request.user.username, request, category, "관리자", audit_log, result
                )


# 시스템 설정
class KeyInfoSettingView(TemplateView):
    template_name = "kms/keyinfo/settings.html"
    context = {}

    def get(self, request, *args, **kwargs):
        return self.render_to_response(self.context)


class KeyInfoSettingsAPI(View):
    @method_decorator(permission_required("kms.view_settings", raise_exception=True))
    def get(self, request):
        try:
            for param in request.GET.items():
                key = param[0]
                value = param[1]

                # XSS 방지를 위한 파라미터
                if key == "draw":
                    draw = value

            data_cols_args = ["id", "key", "description", "value"]
            val = list(models.Settings.objects.values(*data_cols_args))

            return JsonResponse(
                {
                    "draw": draw,
                    "recordsTotal": len(val),
                    "recordsFiltered": len(val),
                    "data": val,
                }
            )

        except Exception as e:
            logger.warning(f"[KMSSettingsAPI - get] {to_str(e)}")
            return HttpResponse(status=400)

    @method_decorator(permission_required("kms.change_settings", raise_exception=True))
    def put(self, request):
        # 감사 로그 > 내용
        actions = []

        # 감사 로그 > 결과
        result = False
        try:
            # put data 파싱
            put_data = MultiPartParser(
                request.META, request, request.upload_handlers
            ).parse()[0]

            if check_password(put_data.get("pw"), request.user.password):
                for i, j in zip(put_data.getlist("id"), put_data.getlist("value")):
                    data = models.Settings.objects.get(pk=to_int(i))

                    if data.value != j:
                        org_value = data.value
                        data.value = j
                        actions.append(f"[{data.description}]: {org_value} → {j}")
                        data.save()
                result = True

                return HttpResponse(status=204)
            else:
                return HttpResponse(status=401)

        except Exception as e:
            logger.warning(f"[KMSSettingsAPI - put] {to_str(e)}")
            return HttpResponse(status=400)

        finally:
            # 감사 로그 기록
            audit_log = f"""편집 ( {', '.join(actions)} )"""
            insert_audit_log(
                request.user.username, request, "시스템 설정", "시스템 설정", audit_log, result
            )


def get_keyinfo_settings_value(key):
    result = ""

    try:
        if models.Settings.objects.filter(key=key):
            result = models.Settings.objects.get(key=key).value

    except Exception as e:
        logger.warning(f"[get_keyinfo_settings_value] {to_str(e)}")

    finally:
        return result
