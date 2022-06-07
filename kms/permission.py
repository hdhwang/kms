from django.utils.translation import gettext_lazy as _
from rest_framework.permissions import IsAuthenticated
from rest_framework import HTTP_HEADER_ENCODING, exceptions
from kms.util.logHelper import insert_audit_log

category = 'API 요청'


def get_authorization_header(request):
    """
    Return request's 'Authorization:' header, as a bytestring.

    Hide some test client ickyness where the header can be unicode.
    """
    auth = request.META.get('HTTP_AUTHORIZATION', b'')
    if isinstance(auth, str):
        # Work around django test client oddness
        auth = auth.encode(HTTP_HEADER_ENCODING)
    return auth


class IsAuthenticated(IsAuthenticated):
    # 감사 로그 > 결과
    result = False

    def has_permission(self, request, view):

        if not bool(request.user and request.user.is_authenticated):
            auth = get_authorization_header(request)

            msg = _('Invalid token header. No credentials provided.')
            if len(auth):
                action = f'{msg} ( 토큰 헤더 : {auth.decode("utf-8")} )'
            else:
                action = f'{msg} ( 토큰 헤더 누락 )'

            insert_audit_log(None, request, category, '-', action, self.result)

        return bool(request.user and request.user.is_authenticated)
