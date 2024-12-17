import ipaddress
import logging
from datetime import datetime

from django.contrib.auth.decorators import permission_required
from django.db.models import CharField, DateTimeField
from django.db.models.functions import Cast, TruncSecond
from django.http import JsonResponse, HttpResponse
from django.utils.decorators import method_decorator
from django.views.generic import TemplateView, View

from kms import models
from utils.dic_helper import insert_dic_data, get_dic_value
from utils.format_helper import to_int, to_str
from utils.regex_helper import table_filter_regex, ip_cidr_regex

logger = logging.getLogger(__name__)


category = "감사 로그"


# 감사 로그
class AuditLogView(TemplateView):
    template_name = "kms/audit-log.html"
    context = {}

    def get(self, request, *args, **kwargs):
        return self.render_to_response(self.context)


class AuditLogAPI(View):
    @method_decorator(permission_required("kms.view_auditlog", raise_exception=True))
    def get(self, request):
        try:
            # 컬럼 리스트
            column_list = (
                "user",
                "ip",
                "category",
                "sub_category",
                "action",
                "result",
                "date",
            )

            # 정렬 설정
            ordering = "-date"  # 기본 값 : 일자 (최신) 기준

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

                # 일자 기준 시작 일자
                elif key == "start_date":
                    start_time = datetime.strptime(value, "%Y-%m-%d %H:%M:%S")
                    insert_dic_data(filter_params, "date__gte", start_time)

                # 일자 기준 종료 일자
                elif key == "end_date":
                    end_time = datetime.strptime(value, "%Y-%m-%d %H:%M:%S")
                    insert_dic_data(filter_params, "date__lte", end_time)

                # XSS 방지를 위한 파라미터
                elif key == "draw":
                    draw = value

                # 정렬 설정
                elif key == "order[order]":
                    req_ordering = value
                    req_order_dir = request.GET.get("order[dir]")

                    # audit_date가 입력된 경우 실제 필드인 date로 치환
                    if req_ordering == "audit_date":
                        req_ordering = "date"

                    if req_ordering in column_list:
                        ordering = req_order_dir + req_ordering

                # 필터 설정
                elif table_filter_regex.search(key) and value != "":
                    filter_key = f'{key.split("[value]")[0]}[data]'
                    filter_name = get_dic_value(request.GET, filter_key)

                    # 사용자
                    if filter_name == "user":
                        insert_dic_data(filter_params, "user__icontains", value)

                    # IP 주소
                    elif filter_name == "ip":
                        # IP 주소 또는 CIDR 형태인 경우 (192.168.0.1 or 192.168.0.1/24)
                        if ip_cidr_regex.match(value):
                            ip_addr = ipaddress.ip_network(value, False)

                            start_ip = to_int(ip_addr.network_address)
                            end_ip = to_int(ip_addr.broadcast_address)

                            insert_dic_data(filter_params, "ip__gte", start_ip)
                            insert_dic_data(filter_params, "ip__lte", end_ip)

                        else:
                            insert_dic_data(filter_params, "ip", value)

                    # 카테고리
                    elif filter_name == "category":
                        insert_dic_data(filter_params, "category", value)

                    # 보조 카테고리
                    elif filter_name == "sub_category":
                        insert_dic_data(filter_params, "sub_category", value)

                    # 내용
                    elif filter_name == "action":
                        insert_dic_data(filter_params, "action__icontains", value)

                    # 결과
                    elif filter_name == "result":
                        insert_dic_data(filter_params, "result", value)

            data_cols_args = [
                "user",
                "ip",
                "category",
                "sub_category",
                "action",
                "result",
            ]
            data_cols_kwargs = dict(
                audit_date=Cast(TruncSecond("date", DateTimeField()), CharField())
            )
            val = list(
                models.AuditLog.objects.extra(select={"ip": "inet_ntoa(ip)"})
                .values(*data_cols_args, **data_cols_kwargs)
                .filter(**filter_params)
                .order_by(ordering)[limit_start:limit_end]
            )

            # 전체 레코드 수 조회
            records_total = models.AuditLog.objects.filter(**filter_params).count()

            return JsonResponse(
                {
                    "draw": draw,
                    "recordsTotal": records_total,
                    "recordsFiltered": records_total,
                    "data": val,
                }
            )

        except Exception as e:
            logger.warning(f"[AuditLogAPI - get] {to_str(e)}")
            return HttpResponse(status=400)
