from kms import models
from django.contrib.auth.models import User
from kms.util.formatHelper import *
from kms.util.networkHelper import get_client_ip
import logging

logger = logging.getLogger(__name__)


def insert_audit_log(user, request, category, sub_category, action, result):
    log_result = False
    try:
        ip_int = (
            ip_to_int(get_client_ip(request))
            if type(ip_to_int(get_client_ip(request))) is int
            else None
        )

        audit_log_data = models.AuditLog(
            user=user,
            ip=ip_int,
            category=category,
            sub_category=sub_category,
            action=action,
            result=models.ChoiceYN.Y if result is True else models.ChoiceYN.N,
        )
        audit_log_data.save()
        log_result = True

    except Exception as e:
        logger.warning(f"[insert_audit_log] {to_str(e)}")

    finally:
        return log_result
