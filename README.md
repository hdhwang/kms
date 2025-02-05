# KMS

### Key Management Service

> 프로젝트 관련 패키지 설치

```
$ pip3 install -r requirements.txt
```

> Django 모델 -> 데이터베이스 마이그레이션

```
$ python3 manage.py makemigrations --settings=config.settings.development
$ python3 manage.py migrate --settings=config.settings.development
```

> 프로젝트 구성을 위한 필수 DB 데이터 로드

```
$ python3 manage.py loaddata kms/data_fixture.json --settings=config.settings.development
$ python3 manage.py loaddata kms/data_auth.json --settings=config.settings.development
```

> 프로젝트 SuperUser 생성

```
$ python3 manage.py creatsuperuser --settings=config.settings.development
```

> 개발 환경 실행 명령어

```
$ python3 manage.py runserver --settings=config.settings.development
```

> 패키지 목록 조회 방법

```
$ pip3 freeze > requirements.txt
```

> 프로젝트 구성을 위한 필수 DB 데이터 백업 방법

```
$ python3 manage.py dumpdata kms -o kms/data_fixture.json --settings=config.settings.development
$ python3 manage.py dumpdata auth -o kms/data_auth.json --settings=config.settings.development
```

> .env 파일 생성
```
SECRET_KEY=XXXX
ALLOWED_HOSTS=XXXX,XXXX,XXXX
DB_NAME=XXXX
DB_USER=XXXX
DB_PASSWORD=XXXX
DB_HOST=XXXX
DB_PORT=XXXX
AES_KEY=XXXX
AES_KEY_IV=XXXX
```

> 인증서 파일 생성
```
cert/cert.pem
cert/privkey.pem
```
