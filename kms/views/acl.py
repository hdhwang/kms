from django.http import JsonResponse, HttpResponse
from django.http.multipartparser import MultiPartParser
from django.views.generic import TemplateView, View
from django.utils.decorators import method_decorator
from django.contrib.auth.decorators import permission_required
from kms import models
from kms.util.dicHelper import insert_dic_data, get_dic_value
from kms.util.formatHelper import *
from kms.util.logHelper import insert_audit_log
from kms.util.regexHelper import *

import logging
logger = logging.getLogger(__name__)


# 감사 로그 > 카테고리
category = 'API 접근 제어'


# IP 접근 제어
class IPAddrView(TemplateView):
    template_name = 'kms/acl/ip_addr.html'
    context = {}

    def get(self, request, *args, **kwargs):
        return self.render_to_response(self.context)


class IPAddrAPI(View):
    @method_decorator(permission_required('kms.view_ipwhitelist', raise_exception=True))
    def get(self, request):
        try:
            filter_params = {}

            # 컬럼 리스트
            column_list = ('id', 'ip', 'cidr', 'comment')

            # LIMIT 시작 인덱스
            limit_start = 0

            # LIMIT 종료 인덱스
            limit_end = None

            # 정렬
            ordering = '-id'

            # LIMIT 설정
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

                    if req_ordering in column_list:
                        ordering = req_order_dir + req_ordering

                # 필터 설정
                elif table_filter_regex.search(key) and value != '':
                    filter_key = f'{key.split("[value]")[0]}[data]'
                    filter_name = get_dic_value(request.GET, filter_key)

                    # IP 주소
                    if filter_name == 'ip':
                        insert_dic_data(filter_params, 'ip', value)

                    # 설명
                    elif filter_name == 'comment':
                        insert_dic_data(filter_params, 'comment__icontains', value)

            data_cols_args = ['id', 'ip', 'cidr', 'comment']
            val = list(models.IpWhitelist.objects.extra(select={'ip': 'inet_ntoa(ip)'}).values(
                *data_cols_args).filter(**filter_params).order_by(ordering)[limit_start:limit_end])

            # 전체 레코드 수 조회
            records_total = models.IpWhitelist.objects.filter(**filter_params).count()

            return JsonResponse(
                {'draw': draw, 'recordsTotal': records_total, 'recordsFiltered': records_total, 'data': val})

        except Exception as e:
            logger.warning(f'[IPAddrAPI - get] {to_str(e)}')
            return HttpResponse(status=400)

    @method_decorator(permission_required('kms.add_ipwhitelist', raise_exception=True))
    def post(self, request):
        # 감사 로그 > 내용
        actions = []

        # 감사 로그 > 결과
        result = False
        ip = ''
        comment = ''

        try:
            ip = get_dic_value(request.POST, 'ip')
            cidr = to_int(get_dic_value(request.POST, 'cidr', 32))
            comment = get_dic_value(request.POST, 'comment')

            # 동일한 IP 주소가 존재하는 경우
            if models.IpWhitelist.objects.filter(ip=ip_to_int(ip), cidr=cidr):
                return HttpResponse(status=409)

            # 동일한 IP 주소가 존재하지 않는 경우
            else:
                # DB에 데이터 추가
                ip_whitelist = models.IpWhitelist(
                    ip=ip_to_int(ip),
                    cidr=cidr,
                    comment=comment
                )
                ip_whitelist.save()
                result = True

                return HttpResponse(status=201)

        except Exception as e:
            logger.warning(f'[IPAddrAPI - post] {to_str(e)}')
            return HttpResponse(status=400)

        finally:
            # 감사 로그 기록
            full_ip = f'{ip}/{to_str(cidr)}' if cidr != 32 else ip

            actions.append(f'[IP 주소] : {full_ip}')
            actions.append(f'[설명] : {comment}')
            audit_log = f"""추가 ( {', '.join(actions)} )"""

            insert_audit_log(request.user.id, request, category, 'IP 접근 제어', audit_log, result)

    @method_decorator(permission_required('kms.change_ipwhitelist', raise_exception=True))
    def put(self, request, req_id):
        # 감사 로그 > 내용
        actions = []
        actions.append(f'[아이디] : {to_str(req_id)}')

        # 감사 로그 > 결과
        result = False
        try:
            if req_id:

                # put data 파싱
                put_data = MultiPartParser(request.META, request, request.upload_handlers).parse()[0]

                ip = get_dic_value(put_data, 'ip')
                ip_int = ip_to_int(ip)
                cidr = to_int(get_dic_value(put_data, 'cidr'))
                comment = get_dic_value(put_data, 'comment')

                # id 기준으로 IP 주소 조회
                ip_addr_data = models.IpWhitelist.objects.get(pk=to_int(req_id))

                # 변경 사항이 존재하는 항목 수정
                if ip_addr_data.ip != ip_int or ip_addr_data.cidr != cidr:

                    # 동일한 IP 주소가 존재하는 경우
                    if models.IpWhitelist.objects.filter(ip=ip_int, cidr=cidr):
                        return HttpResponse(status=409)
                    
                    # 동일한 IP 주소가 존재하지 않는 경우
                    org_ip_addr = int_to_ip(ip_addr_data.ip)
                    org_cidr = ip_addr_data.cidr
                    org_full_ip = f'{org_ip_addr}/{to_str(org_cidr)}' if org_cidr != 32 else org_ip_addr

                    change_ip_addr = f'{ip}/{to_str(cidr)}' if cidr != 32 else ip

                    # 감사 로그 > 내용 추가
                    actions.append(f'[IP 주소] : {org_full_ip} → {change_ip_addr}')

                    # 항목 수정
                    if ip_addr_data.ip != ip_int:
                        ip_addr_data.ip = ip_int

                    if ip_addr_data.cidr != cidr:
                        ip_addr_data.cidr = cidr

                if ip_addr_data.comment != comment:
                    # 감사 로그 > 내용 추가
                    actions.append(f'[설명] : {to_str(ip_addr_data.comment)} → {comment}')

                    # 항목 수정
                    ip_addr_data.comment = comment

                # 변경 사항 적용
                ip_addr_data.save()
                result = True

                return HttpResponse(status=204)

        except Exception as e:
            logger.warning(f'[IPAddrAPI - put] {to_str(e)}')
            return HttpResponse(status=400)

        finally:
            # 감사 로그 기록
            audit_log = f"""편집 ( {', '.join(actions)} )"""
            insert_audit_log(request.user.id, request, category, 'IP 접근 제어', audit_log, result)

    @method_decorator(permission_required('kms.delete_ipwhitelist', raise_exception=True))
    def delete(self, request, req_id):
        # 감사 로그 > 내용
        actions = []
        actions.append(f'[아이디] : {to_str(req_id)}')

        # 감사 로그 > 결과
        result = False
        ip_str = ''
        comment = ''

        try:
            if req_id:
                # 삭제할 항목 조회
                ip_data = models.IpWhitelist.objects.get(pk=req_id)
                ip_str = int_to_ip(ip_data.ip)

                if ip_data.cidr != 32:
                    ip_str += f'/{to_str(ip_data.cidr)}'

                comment = to_str(ip_data.comment)

                # IP 주소 삭제 수행
                ip_data.delete()

                result = True
                return HttpResponse(status=204)

        except Exception as e:
            logger.warning(f'[IPAddrAPI - delete] {to_str(e)}')
            return HttpResponse(status=400)

        finally:
            # 감사 로그 기록
            actions.append(f'[IP 주소] : {ip_str}')
            actions.append(f'[설명] : {comment}')
            audit_log = f"""삭제 ( {', '.join(actions)} )"""

            insert_audit_log(request.user.id, request, category, 'IP 접근 제어', audit_log, result)
