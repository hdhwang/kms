import ipaddress
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)


def datetime_to_str(param, date_format="%Y-%m-%d %H:%M"):
    result = param
    try:
        result = param.strftime(date_format)

    except Exception as e:
        logger.warning(f"[datetime_to_str] {to_str(e)}")

    finally:
        return result


def str_to_datetime(param, date_format="%Y-%m-%d %H:%M:%S"):
    result = param
    try:
        result = datetime.strptime(param, date_format)

    except Exception as e:
        logger.warning(f"[str_to_datetime] {to_str(e)}")

    finally:
        return result


def to_int(param):
    result = param
    try:
        result = int(param)

    except Exception as e:
        logger.warning(f"[to_int] {to_str(e)}")

    finally:
        return result


def to_str(param):
    result = param
    try:
        result = str(param)

    except Exception as e:
        logger.warning(f"[to_str] {str(e)}")

    finally:
        return result


def utc_to_local(utc_dt):
    return utc_dt.replace(tzinfo=timezone.utc).astimezone(tz=None)


# 이메일에서 도메인을 제외한 아이디 부분만 추출
def split_email_domain(data_list):
    result = []

    try:
        for data in data_list:
            result.append(data.split("@")[0])

    except Exception as e:
        logger.warning(f"[split_email_domain] {to_str(e)}")

    finally:
        return result


def int_to_ip(input_ip):
    ip_addr = input_ip

    try:
        ip_addr = to_str(ipaddress.IPv4Address(ip_addr))

    except Exception as e:
        logger.warning(f"[int_to_ip] {to_str(e)}")

    finally:
        return ip_addr


def ip_to_int(input_ip):
    ip_addr = input_ip

    try:
        ip_addr = to_int(ipaddress.IPv4Address(ip_addr))

    except Exception as e:
        logger.warning(f"[ip_to_int] {to_str(e)}")

    finally:
        return ip_addr


def list_to_str(param):
    result = param
    try:
        result = ",".join(param)

    except Exception as e:
        logger.warning(f"[list_to_str] {str(e)}")

    finally:
        return result
