#!/bin/bash

ACCESS_LOG_FILE=${LOG_DIR}/gunicorn-access.log
ERROR_LOG_FILE=${LOG_DIR}/gunicorn-error.log
WORKERS=3
THREADS=30
TIMEOUT=300

python3 manage.py collectstatic --skip-checks --no-input --clear > /dev/null 2>&1

python3 $SCRIPT_PATH/manage.py crontab add

nginx

gunicorn --bind 127.0.0.1:8080 config.wsgi:application \
--workers=${WORKERS} \
--threads=${THREADS} \
--access-logfile=${ACCESS_LOG_FILE} \
--error-logfile=${ERROR_LOG_FILE} \
--preload --timeout ${TIMEOUT}
