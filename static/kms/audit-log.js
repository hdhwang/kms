'use strict';

const requestUrl = '/audit-log/api';   //API URL
let startDate = '';                        //검색 기간(시작일)
let endDate = '';                          //검색 기간(종료일)
const ipPattern = /\b((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/;

//검색 기간 초기화
function initDateRange() {
    startDate = moment(new Date()).add(-1, 'month').format('YYYY-MM-DD 00:00:00');  //오늘 날짜 기준 - 1 개월
    endDate = moment(new Date()).format('YYYY-MM-DD 23:59:59');                     //오늘 날짜
}

//검색 기간 설정
function setDateRange() {
    startDate = $('#date-range-picker').data('daterangepicker').startDate.format('YYYY-MM-DD HH:mm:00');  //daterangepicker에 설정된 startDate
    endDate = $('#date-range-picker').data('daterangepicker').endDate.format('YYYY-MM-DD HH:mm:59');      //daterangepicker에 설정된 endDate
}

//검색 기간 지정 초기화
function initDatePicker() {
    $('#date-range-picker').daterangepicker({
        timePicker: true,
        timePicker24Hour: true,
        timePickerIncrement: 1,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        showDropdowns: true,
        locale: getDateRangePickerLocale()
    });

    $('#date-range-picker').off('apply.daterangepicker').on('apply.daterangepicker', function (ev, picker) {
        const diffDateRange = getDiffDateRange($('#date-range-picker')); //검색 기간(초) 조회

        //검색 기간이 365 일을 초과하는 경우 알림 출력 후 종료
        if (diffDateRange >= 31536000) {
            showModal('경고', '감사 로그 검색 기간은 365 일을 초과할 수 없습니다.');
        }

        //검색 기간이 365 일 이내인 경우
        else {
            setDateRange();             //검색 기간 설정
            reloadTable();              //설정된 검색 기간 기준으로 조회
        }
    });
}

//데이터 테이블 초기화
function initDataTable() {
    //DataTable 설정
    let table = $('#table-data').DataTable({
        autoWidth: false,
        responsive: true,
        processing: true,                       //처리 중 화면 출력
        serverSide: true,                       //serverSide 설정을 통해 해당 페이지 데이터만 조회
        language: getDataTableLanguage(),       //언어 설정
        ajax: {
            type: 'GET',
            url: requestUrl,
            data: function (data) {              //조회 파라미터
                data.start_date = startDate;  //시작일
                data.end_date = endDate;      //종료일

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
                data: null,
                defaultContent: '',
                render: function (data, type, row, meta) {
                    return meta.settings._iDisplayStart + meta.row + 1;
                },
                orderable: false,
            },
            { className: 'dt-center', data: 'user__username', defaultContent: '', render: $.fn.dataTable.render.text() },
            { className: 'dt-center', data: 'ip', defaultContent: '', render: $.fn.dataTable.render.text() },
            { className: 'dt-center', data: 'category', defaultContent: '', render: $.fn.dataTable.render.text() },
            { className: 'dt-center', data: 'sub_category', defaultContent: '', render: $.fn.dataTable.render.text() },
            { className: 'dt-left', data: 'action', defaultContent: '', render: $.fn.dataTable.render.text() },
            {
                className: 'dt-center',
                data: 'result',
                defaultContent: '',
                render: function (data, type, row) {
                    let html = (data == 1) ? '<span class="badge bg-primary">성공</span>' : '<span class="badge bg-danger">실패</span>';
                    return html;
                }
            },
            { className: 'dt-center', data: 'audit_date', defaultContent: '', render: $.fn.dataTable.render.text() },
        ],
        rowId: 'field_id',
        dom: getDataTablesDom(),
        lengthMenu: [[10, 20, 50], [10, 20, 50]],                  //페이지 당 갯수
        order: [[7, 'desc']],                                    //조회 시 일자 기준 기본 정렬
        drawCallback: function (settings, json)                     //조회 완료 후 처리
        {
        },
        buttons: [
            {
                name: 'refresh',
                text: '<i class="fa fa-redo"></i> 새로고침',
                action: function () {
                    //새로고침 수행 시 검색 기간을 초기화 후 데이터 조회
                    initDateRange();
                    initDatePicker();
                    reloadTable();
                }
            },
            {
                extend: 'colvis',
                text: '<i class="fa fa-columns"></i> 필드 보기'
            }
        ]
    });

    //데이터 테이블 필터
    table.columns().every(function () {
        let that = this;

        $('#table-foot input').off('keyup change').on('keyup change', function (e) {
            //엔터 버튼을 클릭한 경우
            if (e.keyCode == 13) {
                const col = $(this).parents('th').attr('data-column');
                const val = escapeHtml(this.value);

                //값이 변경된 경우
                if (that.column(col).search() !== val) {
                    if (val != '' && col == 2 && ipPattern.test(val) == false) {
                        showModal('경고', val + '은 올바른 IP 형식이 아닙니다. <br/>올바른 IP 주소를 입력하십시오.');
                        this.value = '';
                    }

                    else {
                        that.column(col).search(val, false, true).draw();
                    }
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

function reloadTable() {
    //DataTable 조회 수행
    $('#table-data').DataTable().ajax.reload();
}

$(function () {
    initDateRange();
    initDatePicker();
    initDataTable();

    //마우스 우클릭 - 컨텍스트 메뉴
    $.contextMenu({
        selector: '#table-data tbody tr',
        callback: function (key, options) {
            const table = $('#table-data').DataTable();

            switch (key) {
                case 'refresh':
                    //새로고침 버튼 클릭
                    table.buttons('refresh:name').trigger();
                    break;
            }
        },

        items: {
            refresh: { name: '새로고침' },
        }
    });
});