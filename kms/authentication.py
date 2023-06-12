from django.utils.translation import gettext_lazy as _
from kms.util.logHelper import insert_audit_log
from rest_framework import HTTP_HEADER_ENCODING, exceptions
from rest_framework.authentication import TokenAuthentication

category = "API 요청"


def get_authorization_header(request):
    """
    Return request's 'Authorization:' header, as a bytestring.

    Hide some test client ickyness where the header can be unicode.
    """
    auth = request.META.get("HTTP_AUTHORIZATION", b"")
    if isinstance(auth, str):
        # Work around django test client oddness
        auth = auth.encode(HTTP_HEADER_ENCODING)
    return auth


class TokenAuthentication(TokenAuthentication):
    # 감사 로그 > 결과
    result = False

    def authenticate(self, request):
        auth = get_authorization_header(request).split()

        if not auth or auth[0].lower() != self.keyword.lower().encode():
            return None

        # 토큰 헤더
        token_header = get_authorization_header(request).decode("utf-8")

        if len(auth) == 1:
            msg = _("Invalid token header. No credentials provided.")

            # 감사 로그 기록
            action = f"{msg} ( 토큰 헤더 : {token_header} )"
            insert_audit_log(None, request, category, "-", action, self.result)

            raise exceptions.AuthenticationFailed(msg)

        elif len(auth) > 2:
            msg = _("Invalid token header. Token string should not contain spaces.")

            # 감사 로그 기록
            action = f"{msg} ( 토큰 헤더 : {token_header} )"
            insert_audit_log(None, request, category, "-", action, self.result)

            raise exceptions.AuthenticationFailed(msg)

        try:
            token = auth[1].decode()
        except UnicodeError:
            msg = _(
                "Invalid token header. Token string should not contain invalid characters."
            )

            # 감사 로그 기록
            action = f"{msg} ( 토큰 헤더 : {token_header} )"
            insert_audit_log(None, request, category, "-", action, self.result)

            raise exceptions.AuthenticationFailed(msg)

        return self.authenticate_credentials(token, request)

    def authenticate_credentials(self, key, request=None):
        model = self.get_model()
        try:
            # 토큰 헤더
            token_header = (
                get_authorization_header(request).decode("utf-8")
                if request is not None
                else ""
            )
            token = model.objects.select_related("user").get(key=key)

        except model.DoesNotExist:
            msg = _("Invalid token.")

            # 감사 로그 기록
            action = f"{msg} ( 토큰 헤더 : {token_header} )"
            insert_audit_log(None, request, category, "-", action, self.result)

            raise exceptions.AuthenticationFailed(msg)

        if not token.user.is_active:
            msg = _("User inactive or deleted.")

            # 감사 로그 기록
            action = f"{msg} ( 토큰 헤더 : {token_header} )"
            insert_audit_log(None, request, category, "-", action, self.result)

            raise exceptions.AuthenticationFailed(msg)

        return token.user, token
