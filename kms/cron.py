from config.settings import DATABASES
from kms.util.formatHelper import *
import logging
import os
import time

logger = logging.getLogger(__name__)


# 로그 백업 및 보관 기간 초과된 백업 파일 삭제
def log_backup():
    try:
        # DB 접속 정보
        db_user = DATABASES["default"]["USER"]
        db_pw = DATABASES["default"]["PASSWORD"]
        db_name = DATABASES["default"]["NAME"]
        db_host = DATABASES["default"]["HOST"]

        # 로그 백업 경로
        log_path = os.path.abspath(__file__ + "/../../backup/log_backup")
        table_name = "audit_log"
        log_file_name = f"{table_name}.sql.gz"

        # 로그 백업 수행
        backup_cmd = f"mysqldump -u{db_user} -p{db_pw} -h {db_host} --max_allowed_packet=1024M {db_name} {table_name} | gzip -c > {log_path}/{log_file_name}"
        os.system(backup_cmd)

        # 사용자 목록 백업 수행 (audit_log의 user 필드 값이 auth_user 테이블의 id 필드로 되어 있어 매칭 목적)
        user_list_file_name = f"user_list"
        user_list_cmd = f"""mysql -u{db_user} -p{db_pw} -h {db_host} {db_name} -e \"SELECT id, username AS '아이디', CASE is_superuser WHEN 0 THEN '사용자' WHEN 1 THEN '관리자' END AS '유형', first_name AS '이름', email AS '이메일', CASE is_active WHEN 0 THEN '비활성' WHEN 1 THEN '활성' END AS '활성화', date_joined AS '등록 일자', last_login AS '마지막 접속 시간' FROM auth_user\" > {log_path}/{user_list_file_name}"""
        os.system(user_list_cmd)

        # tar.gz 압축 수행
        now = time.localtime()
        now_date = "%04d-%02d-%02d" % (now.tm_year, now.tm_mon, now.tm_mday)
        compress_file_name = f"{now_date}.tar.gz"
        compress_cmd = f"cd {log_path};tar zcf {compress_file_name} {log_file_name} {user_list_file_name}"
        os.system(compress_cmd)

        # 압축 후 로그 백업, 사용자 목록 파일 삭제
        tmp_delete_cmd = f"cd {log_path};rm -rf {log_file_name} {user_list_file_name}"
        os.system(tmp_delete_cmd)

        # 일정 시간 경과된 백업 파일 삭제 수행
        # 백업 파일 삭제 기준 (12개월 = 365일), 기준보다 1 작게 입력
        mtime = 364

        # 백업 파일 삭제 수행
        delete_cmd = f'find {log_path} -name "*.tar.gz" -mtime +{mtime} -delete'
        os.system(delete_cmd)

    except Exception as e:
        logger.warning(f"[log_backup] {to_str(e)}")


# 키 백업 및 보관 기간 초과된 백업 파일 삭제
def key_backup():
    try:
        # DB 접속 정보
        db_user = DATABASES["default"]["USER"]
        db_pw = DATABASES["default"]["PASSWORD"]
        db_name = DATABASES["default"]["NAME"]
        db_host = DATABASES["default"]["HOST"]

        # 로그 백업 경로
        log_path = os.path.abspath(__file__ + "/../../backup/key_backup")
        key_table_name = "keyinfo"
        key_file_name = f"{key_table_name}.sql.gz"

        # 키 백업 수행
        key_backup_cmd = f"mysqldump -u{db_user} -p{db_pw} -h {db_host} --max_allowed_packet=1024M {db_name} {key_table_name} | gzip -c > {log_path}/{key_file_name}"
        os.system(key_backup_cmd)

        # IP 접근 제어 백업 수행
        ip_table_name = "ip_whitelist"
        ip_file_name = f"{ip_table_name}.sql.gz"
        ip_backup_cmd = f"mysqldump -u{db_user} -p{db_pw} -h {db_host} --max_allowed_packet=1024M {db_name} {ip_table_name} | gzip -c > {log_path}/{ip_file_name}"
        os.system(ip_backup_cmd)

        # tar.gz 압축 수행
        now = time.localtime()
        now_date = "%04d-%02d-%02d" % (now.tm_year, now.tm_mon, now.tm_mday)
        compress_file_name = f"{now_date}.tar.gz"
        compress_cmd = (
            f"cd {log_path};tar zcf {compress_file_name} {key_file_name} {ip_file_name}"
        )
        os.system(compress_cmd)

        # 압축 후 로그 백업, 사용자 목록 파일 삭제
        tmp_delete_cmd = f"cd {log_path};rm -rf {key_file_name} {ip_file_name}"
        os.system(tmp_delete_cmd)

        # 일정 시간 경과된 백업 파일 삭제 수행
        # 백업 파일 삭제 기준 (30일), 기준보다 1 작게 입력
        mtime = 29

        # 백업 파일 삭제 수행
        delete_cmd = f'find {log_path} -name "*.tar.gz" -mtime +{mtime} -delete'
        os.system(delete_cmd)

    except Exception as e:
        logger.warning(f"[key_backup] {to_str(e)}")
