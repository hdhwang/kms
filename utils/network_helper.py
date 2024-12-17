import logging

import rest_framework
from django.core.handlers import wsgi, asgi

from utils.format_helper import to_str

logger = logging.getLogger(__name__)


def get_client_ip(request):
    if isinstance(request, wsgi.WSGIRequest) or isinstance(request, asgi.ASGIRequest) or isinstance(request, rest_framework.request.Request):
        x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")

        if x_forwarded_for:
            # XFF 헤더의 첫 번째 값을 IP로 설정
            result = x_forwarded_for.split(",")[0]

        else:
            result = request.META.get("REMOTE_ADDR")

    else:
        result = to_str(request)

    return result
