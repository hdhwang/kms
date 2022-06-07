from django.core.handlers import wsgi
from kms.util.formatHelper import *

import logging
import rest_framework
logger = logging.getLogger(__name__)


def get_client_ip(request):
    if type(request) == wsgi.WSGIRequest or type(request) == rest_framework.request.Request:
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')

        if x_forwarded_for:
            # XFF 헤더의 가장 마지막 값을 IP로 설정
            xff_split = x_forwarded_for.split(',')
            result = xff_split[xff_split.__len__() - 1]

        else:
            result = request.META.get('REMOTE_ADDR')

    else:
        result = to_str(request)

    return result
