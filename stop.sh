#!/bin/bash
export DJANGO_SETTINGS_MODULE="config.settings.production"
SCRIPT_PATH=$(dirname $(realpath $0))

RUN_PATH=${SCRIPT_PATH}/run
PID_FILE=${RUN_PATH}/kms.pid

if [ -f $PID_FILE ]; then
    # PID 파일이 있으면 종료
    kill -9 $(cat $PID_FILE)
    rm -f ${PID_FILE}
    echo "kms stopped successfully."
fi
$SCRIPT_PATH/venv/bin/python3 $SCRIPT_PATH/manage.py crontab remove
