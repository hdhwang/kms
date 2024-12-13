#!/bin/bash
export DJANGO_SETTINGS_MODULE="config.settings.production"
SCRIPT_PATH=$(dirname $(realpath $0))

LOGS_PATH=${SCRIPT_PATH}/logs
ACCESS_LOG_FILE=${LOGS_PATH}/gunicorn-access.log
ERROR_LOG_FILE=${LOGS_PATH}/gunicorn-error.log

RUN_PATH=${SCRIPT_PATH}/run
SOCKET_FILE=${RUN_PATH}/kms.sock
PID_FILE=${RUN_PATH}/kms.pid
WORKERS=3
THREADS=30
TIMEOUT=300

if [ ! -d ${LOGS_PATH} ] ; then
  mkdir -p ${LOGS_PATH}
fi

if [ ! -d ${RUN_PATH} ] ; then
  mkdir -p ${RUN_PATH}
fi

if [ -e ${SOCKET_FILE} ]; then
    rm -f ${SOCKET_FILE}
fi

source $SCRIPT_PATH/venv/bin/activate
$SCRIPT_PATH/venv/bin/python3 $SCRIPT_PATH/manage.py crontab add

sleep 3

gunicorn config.wsgi:application \
--bind unix:${SOCKET_FILE} \
--workers=${WORKERS} \
--threads=${THREADS} \
--pid ${PID_FILE} \
--access-logfile=${ACCESS_LOG_FILE} \
--error-logfile=${ERROR_LOG_FILE} \
--timeout ${TIMEOUT}
--preload \
--daemon \

deactivate