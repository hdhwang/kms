'use strict';

const requestUrl = '/keyinfo/admin/api';   //API URL
const requestCheckUserIDUrl = '/keyinfo/admin/check'; //키 중복 확인 URL
const requestValueUrl = '/keyinfo/admin/value';   //키 복호화 API URL

//데이터 테이블 초기화
function initDataTable() {
    //DataTable 설정
    let table = $('#table-data').DataTable({
        autoWidth: false,
        responsive: true,                       //테이블 반응형설정
        processing: true,                       //처리 중 화면 출력
        serverSide: true,                       //serverSide 설정을 통해 해당 페이지 데이터만 조회
        language: getDataTableLanguage(),       //언어 설정
        ajax: {
            type: 'GET',
            url: requestUrl,
            data: function (data) {              //조회 파라미터
                data.order = getDataTablesOrder(data);
                data.filter = getDataTablesFilterColumns(data);
                delete data.columns;
            },
            error: function (xhr, error, thrown) {
                checkRedirectLoginPage(error, $(location).attr('pathname'));  //로그인 페이지 리다이렉트 여부 확인

                let msg = getHttpStatusMessage(xhr.status) != '' ? getHttpStatusMessage(xhr.status) : '오류가 발생하였습니다. 잠시 후 다시 시도해 주십시오.';
                toastr.error(msg);
                $('#table-data_processing').hide();
            }
        },
        deferRender: true,
        columns: [                              //출력할 컬럼 정보
            {
                className: 'dt-center',
                data: 'key',
                defaultContent: '',
                render: function (data, type) {
                    data = escapeHtml(data);
                    if (type === 'display') {
                        const id = 'radio-' + data;
                        return '<div class="icheck-primary"><input type="radio" name="selected-key" id="' + id +
                            '" value="' + data + '"><label for="' + id + '"></label></div>';
                    }
                    return data;
                },
                orderable: false
            },
            {
                className: 'dt-center',
                data: null,
                defaultContent: '',
                render: function (data, type, row, meta) {
                    return meta.settings._iDisplayStart + meta.row + 1;
                },
                orderable: false
            },
            { className: 'dt-center link', data: 'user_id__username', defaultContent: '', render: $.fn.dataTable.render.text() },
            { className: 'dt-center link', data: 'key', defaultContent: '', render: $.fn.dataTable.render.text() },
            {
                className: 'dt-center',
                data: null,
                defaultContent: '',
                render: function (data, type, row) {
                    let html = '<button type="button" class="btn btn-default btn-flat value-btn">보기</button>';

                    return html;
                },
                orderable: false
            },
            { className: 'dt-center link', data: 'description', defaultContent: '', render: $.fn.dataTable.render.text() },
            { className: 'dt-center link', data: 'date', defaultContent: '', render: $.fn.dataTable.render.text() },
        ],
        rowId: 'user_id',
        dom: getDataTablesDom(),
        lengthMenu: [[10, 20, 50], [10, 20, 50]],                 //페이지 당 갯수
        order: [[6, 'desc']],                                  //조회 시 생성 일자 기준 기본 정렬
        drawCallback: function (settings, json)                   //조회 완료 후 처리
        {
            //iCheck 초기화
            initICheck();

            // 검색 필터에 이벤트 추가
            $('.dataTables_filter input').unbind();
            $('.dataTables_filter input').bind('keyup', function (e) {
                // 엔터 키 입력 시 데이터 조회
                if (e.keyCode == 13) {
                    table.search(this.value).draw();
                }
            });
        },
        buttons: [
            {
                name: 'refresh',
                text: '<i class="fa fa-redo"></i> 새로고침',
                action: function () {
                    reloadTable();
                }
            },
            {
                name: 'add',
                text: '<i class="fa fa-plus"></i> 추가',
                action: function () {
                    openModal();
                }
            },
            {
                name: 'del',
                text: '<i class="fa fa-minus"></i> 삭제',
                action: function () {
                    openDeleteModal();
                }
            },
            {
                extend: 'colvis',
                text: '<i class="fa fa-columns"></i> 필드 보기'
            }
        ]
    });

    //클릭 시 편집 수행
    $('#table-data tbody').off('click', 'td').on('click', 'td', function () {
        //link 클래스가 존재하는 경우에만 편집 모달 출력
        if ($(this).hasClass('link')) {
            const data = $('#table-data').DataTable().row($(this).parent()).data();
            openModal(data);
        }
    });

    //dataTables 하위에 존재하는 버튼 클릭 시
    $('#table-data tbody').off('click', 'button').on('click', 'button', function () {
        const data = $('#table-data').DataTable().row($(this).parent().parent()).data();

        //보기 클릭 시 모달창 출력
        if ($(this).hasClass('value-btn')) {
            const key = data.key;
            const user_id = data.user_id;

            let param = new FormData();
            param.append('user_id', user_id);
            param.append('key', key);

            getValueData(key, param);
        }
    });

    //데이터 테이블 필터
    table.columns().every(function () {
        let that = this;

        $('#table-foot input').off('keyup change').on('keyup change', function (e) {
            //엔터 버튼을 클릭한 경우
            if (e.keyCode == 13) {
                const col = $(this).parents('th').attr('data-column');
                const val = this.value;

                //값이 변경된 경우
                if (that.column(col).search() !== val) {
                    that.column(col).search(val, false, true).draw();
                }
            }
        });

        $('#table-foot select').off('keyup change').on('keyup change', function () {
            const col = $(this).parents('th').attr('data-column');
            const val = this.value;

            //값이 변경된 경우
            if (that.column(col).search() !== val) {
                that.column(col).search(val, false, true).draw();
            }
        });
    });
}

function getValueData(key, data) {
    axios(
        {
            method: 'POST',
            url: requestValueUrl,
            data: data,
        })
        .then(function (response) {
            //조회 성공 시 키 값 모달창 출력
            if (response && response.data && response.data.data) {
                openValueModal(response.data.username, key, response.data.data);
            }

            else {
                checkRedirectLoginPage(response, $(location).attr('pathname'));  //로그인 페이지 리다이렉트 여부 확인

                let msg = '키 값 조회에 실패하였습니다. ' + getHttpStatusMessage(response.status);
                toastr.error(msg);
            }

            //패스워드 입력 모달 닫기
            closePasswordModal();
        })
        .catch(function (error) {
            if (error.response.status == 400) {
                //여러 번 클릭하여 요청하는 것을 방지하기 위해 0.5초 딜레이를 줌
                setTimeout(function () {
                    showPasswordModal('키 값 조회를 위해 비밀번호 입력이 필요합니다. 비밀번호를 입력하십시오.',
                        function (result) {
                            data.append('user_data', result);
                            getValueData(key, data);
                        }
                    );
                }, 500);
            }

            else if (error.response.status == 401) {
                let msg = '키 값 조회에 실패하였습니다. 비밀번호가 일치하지 않습니다.';
                toastr.error(msg);

                //확인 버튼 활성화
                changePWModalBtnStatus(true);
            }

            else if (error.response.status == 409) {
                let msg = '키 값 조회에 실패하였습니다. 키를 찾을 수 없습니다.';
                toastr.error(msg);

                //패스워드 입력 모달 존재 시 닫기
                closePasswordModal();

                reloadTable();
            }

            else {
                checkRedirectLoginPage(error, $(location).attr('pathname'));  //로그인 페이지 리다이렉트 여부 확인

                let msg = '키 값 조회에 실패하였습니다. ' + getHttpStatusMessage(error.response.status);
                toastr.error(msg);

                //패스워드 입력 모달 존재 시 닫기
                closePasswordModal();
            }
        });
}

//키 추가 시 중복 확인 관련 변수
let checkedUserID = '';
let checkedKeyInfoID = false;
let checkedKeyInfoIDText = '';

//중복 확인 관련 모든 변수 초기화
function clearKeyInfoIDCheckStatus() {
    checkedUserID = '';
    checkedKeyInfoID = false;
    checkedKeyInfoIDText = '';
}

//중복 확인 관련 변수에 값 설정
function setCheckFieldStatus(status) {
    checkedUserID = $('#user').val();
    checkedKeyInfoID = status;
    checkedKeyInfoIDText = $('#keyinfo-id').val();
}

function openModal(data = null) {
    //모달이 열릴 때
    $('#menu-modal').off('show.bs.modal').on('show.bs.modal', function () {
        clearFormData('#menu-modal');

        //편집인 경우
        if (data) {
            $('#modal-title').text('키 편집');      //타이틀 지정
            setOrgData(data);                            //데이터 세팅
            $('#btn-ok').text('편집');                   //편집 버튼 명 지정

            setFormControlDisabled(true);
        }

        //추가인 경우
        else {
            $('#modal-title').text('키 추가');  //타이틀 지정
            $('#btn-ok').text('추가');  //추가 버튼 명 지정
            setFormControlDisabled(false);
        }
    });

    //초기화 버튼 클릭 시
    $('#btn-reset').off('click').on('click', function () {
        //키 편집인 경우 기존 정보로 초기화
        if (data) {
            setOrgData(data);
        }

        //키 추가인 경우 모든 항목 공백으로 초기화
        else {
            clearFormData('#menu-modal');
        }
    });

    //추가 / 편집 버튼 클릭 시
    $('#btn-ok').off('click').on('click', function () {
        //사용자가 선택되지 않은 경우
        if ($('#user').val() === '0') {
            showModal('경고', '사용자를 선택하십시오.');
        }

        else if ($.trim($('#keyinfo-id').val()) === '') {
            showModal('경고', '키를 입력하십시오.');
        }

        else if (checkedUserID != $('#user').val() || checkedKeyInfoID == false || (checkedKeyInfoIDText != $('#keyinfo-id').val())) {
            showModal('경고', '키 중복 확인이 필요합니다.');
        }

        // 키 추가인 경우에만 키 값 유효성 검증
        else if (data == null && $.trim($('textarea#keyinfo-value').val()) === '') {
            showModal('경고', '키 값을 입력하십시오.');
        }

        // 사용 불가 단어 포함 여부 체크
        else if (checkWordValidation($.trim($('textarea#description').val())) == false) {
            showModal('경고', '설명에 ' + $.trim($('textarea#description').val()) + '(은)는 사용할 수 없습니다.')
        }

        else {
            $('#menu-modal').modal('hide');

            let param = new FormData();
            param.append('user', $('#user').val());
            param.append('key', $('#keyinfo-id').val());
            param.append('description', $('textarea#description').val());

            // 추가인 경우에만 파라미터에 value 항목 추가
            if (data == null) {
                param.append('value', $('textarea#keyinfo-value').val());
            }

            //여러 번 클릭하여 요청하는 것을 방지하기 위해 0.5초 딜레이를 줌
            setTimeout(function () {
                if (data) {
                    //변경된 사항이 존재하는 경우에만 편집 수행
                    if (compareData(data, param) == false) {
                        editData(data.key, param);
                    }
                }

                else {
                    //추가 수행
                    addData(param);
                }
            }, 500);
        }
    });

    //중복 확인 버튼에 클릭 이벤트 추가
    $('#keyinfo-id-check-btn').off('click').on('click', function () {
        checkKeyInfoID();
    });

    //모달이 닫힐 때
    $('#menu-modal').off('hidden.bs.modal').on('hidden.bs.modal', function () {
        clearFormData('#menu-modal');   //모든 입력 및 선택 데이터 초기화
    });

    $('#menu-modal').attr('tabindex', -1);
    $('#menu-modal').modal({
        show: true,
        backdrop: 'static',
        keyboard: true
    });
}

//탐지 필드 확인
function checkKeyInfoID() {
    clearKeyInfoIDCheckStatus();

    //사용자가 선택되지 않은 경우
    if ($('#user').val() === '0') {
        showModal('경고', '사용자를 선택하십시오.');
    }

    //키가 입력되지 않은 경우
    else if ($.trim($('#keyinfo-id').val()) === '') {
        showModal('경고', '키를 입력하십시오.');
    }

    //중복 확인 수행
    else {
        let key = $('#keyinfo-id').val();
        let user = $('#user').val();

        let data = new FormData();
        data.append('key', key);
        data.append('user', user);

        axios(
            {
                method: 'POST',
                url: requestCheckUserIDUrl,
                data: data,
            })
            .then(function (response) {
                if (response.data && response.data.data) {
                    showModal('경고', '사용할 수 없는 키 입니다.');
                }

                else {
                    showModal('알림', '사용 가능한 키 입니다.');
                    setCheckFieldStatus(true);   //중복 확인 관련 변수에 값 설정
                }

            }).catch(function (error) {
                if (error.response.status == 422) {
                    showModal('경고', '사용할 수 없는 문자가 포함되어있습니다.<br><br>[사용 불가 문자]<br>=+,#/?:^$@*"~&%!|()[]<>`\'{}');
                }

                else {
                    console.log(error);
                }
            });
    }
}

function setOrgData(data) {
    $('#user').val(data.user_id);                     //사용자 아이디
    $('#keyinfo-id').val(data.key);                     //키
    $('#description').val(data.description);            //설명

    //중복 확인 항목 설정(추가 시 확인한 항목이므로)
    setCheckFieldStatus(true);
}

function compareData(data, param) {
    if (param.get('description') != data.description) {
        return false;
    }

    return true;
}

function setFormControlDisabled(state) {
    $('#user').attr('disabled', state); // 사용자
    $('#keyinfo-id').attr('disabled', state); // 키
    $('#keyinfo-id-check-btn').attr('disabled', state); // 중복 확인

    if (state == true) {
        $('#form-keyinfo-value').hide(); // 편집 시 키 값 항목 숨김
    }

    else {
        $('#form-keyinfo-value').show(); // 추가 시 키 값 항목 출력
    }
}

function addData(param) {
    axios(
        {
            method: 'POST',
            url: requestUrl,
            data: param,
        })
        .then(function (response) {

            if (response && response.status == 201) {
                toastr.success('키 추가에 성공하였습니다.');
                reloadTable();
            }

            else {
                checkRedirectLoginPage(response, $(location).attr('pathname'));  //로그인 페이지 리다이렉트 여부 확인

                let msg = '키 추가에 실패하였습니다. ' + getHttpStatusMessage(response.status);
                toastr.error(msg);
            }
        })
        .catch(function (error) {
            if (error.response.status == 422) {
                toastr.error('키 추가에 실패하였습니다. 사용할 수 없는 문자가 포함되어있습니다.<br><br>[사용 불가 문자]<br>=+,#/?:^$@*"~&%!|()[]<>`\'{}');
            }

            else {
                let msg = '키 추가에 실패하였습니다. ' + getHttpStatusMessage(error.response.status);
                toastr.error(msg);
            }
        });
}

function editData(key, param) {
    axios(
        {
            method: 'PUT',
            url: requestUrl + '/' + key,
            data: param,

        })
        .then(function (response) {
            if (response && response.status == 204) {
                toastr.success('키 편집에 성공하였습니다.');
                reloadTable();
            }

            //비밀번호 유효성 검증 오류 발생 시
            else if (response && response.data && response.data.error) {
                let msg = '키 편집에 실패하였습니다. ' + response.data.error;
                toastr.error(msg);
            }

            else {
                let msg = '키 편집에 실패하였습니다. ' + getHttpStatusMessage(response.status);
                toastr.error(msg);
            }
        })
        .catch(function (error) {
            if (error.response.status == 409) {
                let msg = '키 편집에 실패하였습니다. 키를 찾을 수 없습니다.';
                toastr.error(msg);

                //패스워드 입력 모달 존재 시 닫기
                closePasswordModal();

                reloadTable();
            }

            else {
                checkRedirectLoginPage(error, $(location).attr('pathname'));  //로그인 페이지 리다이렉트 여부 확인

                let msg = '키 편집에 실패하였습니다. ' + getHttpStatusMessage(error.response.status);
                toastr.error(msg);
            }
        });
}

// 키 값 확인 모달
function openValueModal(user, key, value) {
    //모달이 열릴 때
    $('#menu-value-modal').off('show.bs.modal').on('show.bs.modal', function () {
        clearFormData('#menu-value-modal');

        const modalValueTitle = key + ' (사용자 : ' + user + ')';
        $('#modal-value-title').text(modalValueTitle);
        $('textarea#decrypt-value').val(value);
    });

    //모달이 닫힐 때
    $('#menu-value-modal').off('hidden.bs.modal').on('hidden.bs.modal', function () {
        clearFormData('#menu-value-modal');   //모든 입력 및 선택 데이터 초기화
    });

    $('#menu-value-modal').attr('tabindex', -1);
    $('#menu-value-modal').modal({
        show: true,
        backdrop: 'static',
        keyboard: true
    });
}

function openDeleteModal() {
    const key = $('input[name="selected-key"]:checked').val();

    //선택한 항목이 있을 경우
    if (key) {
        const user_id = $('input[name="selected-key"]:checked').parent().parent().parent()[0].id;

        if (user_id) {
            showConfirmModal('확인', '선택한 키를 삭제하시겠습니까?',
                function (confirm) {
                    //확인 버튼을 클릭한 경우
                    if (confirm === true) {
                        let data = new Object();
                        data.user_id = user_id;
                        deleteData(key, data);
                    }
                }
            );
        }
    }

    //선택한 항목이 없을 경우
    else {
        showModal('경고', '키를 선택해 주십시오.');
    }
}

function deleteData(key, data) {
    axios(
        {
            method: 'DELETE',
            url: requestUrl + '/' + key,
            data: data
        })
        .then(function (response) {
            if (response && response.status == 204) {
                toastr.success('키 삭제에 성공하였습니다.');
                reloadTable();
            }

            else {
                let msg = '키 삭제에 실패하였습니다. ' + getHttpStatusMessage(response.status);
                toastr.error(msg);
            }

            //패스워드 입력 모달 닫기
            closePasswordModal();
        })
        .catch(function (error) {
            if (error.response.status === 400) {
                //여러 번 클릭하여 요청하는 것을 방지하기 위해 0.5초 딜레이를 줌
                setTimeout(function () {
                    showPasswordModal('키 삭제를 위해 비밀번호 입력이 필요합니다. 비밀번호를 입력하십시오.',
                        function (result) {
                            data.user_data = result;
                            deleteData(key, data);
                        }
                    );
                }, 500);
            }

            else if (error.response.status === 401) {
                let msg = '키 삭제에 실패하였습니다. 비밀번호가 일치하지 않습니다.';
                toastr.error(msg);

                //확인 버튼 활성화
                changePWModalBtnStatus(true);
            }

            else if (error.response.status === 409) {
                let msg = '키 삭제에 실패하였습니다. 키를 찾을 수 없습니다.';
                toastr.error(msg);

                //패스워드 입력 모달 존재 시 닫기
                closePasswordModal();

                reloadTable();
            }

            else {
                checkRedirectLoginPage(error, $(location).attr('pathname'));  //로그인 페이지 리다이렉트 여부 확인

                let msg = '키 삭제에 실패하였습니다. ' + getHttpStatusMessage(error.response.status);
                toastr.error(msg);

                //패스워드 입력 모달 존재 시 닫기
                closePasswordModal();
            }
        });
}

function reloadTable() {
    //DataTable 조회 수행
    $('#table-data').DataTable().ajax.reload();
}

$(function () {
    initDataTable();

    //마우스 우클릭 - 컨텍스트 메뉴
    $.contextMenu({
        selector: '#table-data tbody tr',
        callback: function (key, options) {
            const data = $('#table-data').DataTable().row($(this)).data();
            const table = $('#table-data').DataTable();

            switch (key) {
                case 'refresh':
                    //새로고침 버튼 클릭
                    table.buttons('refresh:name').trigger();
                    break;

                case 'add':
                    //추가 버튼 클릭
                    table.buttons('add:name').trigger();
                    break;

                case 'edit':
                    //편집 모달 출력
                    openModal(data);
                    break;

                case 'del':
                    //삭제 버튼 클릭
                    table.buttons('del:name').trigger();
                    break;
            }
        },

        items: {
            refresh: { name: '새로고침' },
            add: { name: '추가' },
            edit: { name: '편집' },
            del: { name: '삭제' },
        }
    });
});