import calendar
import logging
from datetime import datetime, timedelta

from dateutil import rrule
from dateutil.relativedelta import relativedelta

from utils.format_helper import str_to_datetime, datetime_to_str, to_str

logger = logging.getLogger(__name__)


# 해당 월의 마지막 날짜 조회
def get_days_in_month(date, change_month=0):
    return calendar.monthrange(date.year, date.month + change_month)[1]


# 두 일자 사이의 월 목록 조회
def get_diff_months_list(start_time, end_time, date_format="%Y%m"):
    try:
        result = []

        start_date = datetime.date(str_to_datetime(start_time))
        start_date = start_date.replace(day=1)

        end_date = datetime.date(str_to_datetime(end_time))
        end_date = end_date.replace(day=get_days_in_month(end_date))

        diff_months_list = list(
            rrule.rrule(rrule.MONTHLY, dtstart=start_date, until=end_date)
        )

        for i in range(len(diff_months_list)):
            month = start_date + relativedelta(months=+i)
            result.append(datetime_to_str(month, date_format))

    except Exception as e:
        logger.warning(f"[get_diff_months_list] {to_str(e)}")

    finally:
        return result


# 두 일자 사이의 일 목록 조회
def get_diff_days_list(start_date, end_date):
    try:
        result = []
        delta = end_date - start_date

        for i in range(delta.days + 1):
            result.append(datetime_to_str(start_date + timedelta(days=i), "%Y-%m-%d"))

    except Exception as e:
        logger.warning(f"[get_diff_days_list] {to_str(e)}")

    finally:
        return result
