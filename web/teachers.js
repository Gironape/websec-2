$(document).ready(() => {
    const config = {
        maxWeeks: 52,
        days: ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота']
    };

    const urlParams = new URLSearchParams(window.location.search);
    let staffId = urlParams.get('staffId');
    let currentWeek = parseInt(urlParams.get('week')) || getCurrentAcademicWeek();

    init();

    function init() {
        if (!staffId) {
            showError('Не указан идентификатор преподавателя');
            return;
        }

        generateWeekOptions();
        setupEventListeners();
        loadTeacherSchedule(staffId, currentWeek);
    }

    function setupEventListeners() {
        $('#weekPicker').change(onWeekChange);
        $('#prevWeek').click(() => navigateWeek(-1));
        $('#nextWeek').click(() => navigateWeek(1));
    }

    async function loadTeacherSchedule(staffId, week) {
        console.log(`Loading schedule for staffId: ${staffId}, week: ${week}`);
        showLoading();

        try {
            const response = await fetchSchedule(staffId, week);
            console.log("Данные с сервера:", response);

            renderTeacherSchedule(response);
            updateCurrentWeekDisplay(week);
            updateNavigationButtons(week);
            updateUrlParams(staffId, week);
        } catch (error) {
            handleScheduleError(error);
        } finally {
            hideLoading();
        }
    }

    async function fetchSchedule(staffId, week) {
        try {
            const url = `/api/teacherSchedule?staffId=${staffId}&week=${week}`;
            console.log("URL запроса:", url);

            const response = await $.getJSON(url);

            if (!response || !response.schedule) {
                throw new Error('Неверный формат данных расписания');
            }

            console.log("Данные с сервера (fetchSchedule):", response);
            return response;

        } catch (error) {
            console.error("Error in fetchSchedule:", error);
            throw error;
        }
    }

    function renderTeacherSchedule(data) {
        const {
            teacherName,
            dates,
            schedule
        } = data;

        console.log("Данные для отображения:", data);
        console.log("teacherName:", teacherName);

        $('#teacherHeader').text(teacherName);

        const $table = $('<table>').addClass('schedule-table');
        const $thead = $('<thead>');
        const $tbody = $('<tbody>');
        $thead.append(
            $('<tr>').append(
                $('<th>').text('Время'),
                ...config.days.map((day, index) =>
                    $('<th>').text(`${day}${dates && dates[index] ? ` (${dates[index]})` : ''}`)
                )
            )
        );
        Object.keys(schedule).forEach(time => {
            $tbody.append(
                $('<tr>').append(
                    $('<td>').text(time),
                    ...config.days.map(day => {
                        const lessonContent = schedule[time][day] !== '-' ?
                            formatLessonContent(schedule[time][day]) :
                            '-';
                        return $('<td>').html(lessonContent);
                    })
                )
            );
        });
        $('#scheduleTable').empty().append(
            $thead, $tbody
        );
    }

    function formatLessonContent(html) {
        return html.replace(/<a href="\/rasp\?groupId=(\d+)/g,
            '<a href="group.html?groupId=$1" target="_blank"');
    }

    function updateCurrentWeekDisplay(week) {
        $('#currentWeekDisplay').text(`Неделя ${week}`);
    }

    function updateNavigationButtons(week) {
        const prevWeek = week > 1 ? week - 1 : config.maxWeeks;
        const nextWeek = week < config.maxWeeks ? week + 1 : 1;

        $('#prevWeek').text(`Неделя ${prevWeek}`).attr('title', `Перейти на неделю ${prevWeek}`);
        $('#nextWeek').text(`Неделя ${nextWeek}`).attr('title', `Перейти на неделю ${nextWeek}`);
    }

    function updateUrlParams(staffId, week) {
        const url = new URL(window.location.href);
        url.searchParams.set('staffId', staffId);
        url.searchParams.set('week', week);
        window.history.pushState({}, '', url.toString());
    }

    function generateWeekOptions() {
        const $weekPicker = $('#weekPicker');
        $weekPicker.empty();

        for (let i = 1; i <= config.maxWeeks; i++) {
            $weekPicker.append(
                $('<option>', {
                    value: i,
                    text: `${i} неделя`
                })
            );
        }

        if (currentWeek) {
            $weekPicker.val(currentWeek);
        }
    }

    function onWeekChange() {
        const selectedWeek = parseInt($(this).val(), 10);
        currentWeek = selectedWeek;
        loadTeacherSchedule(staffId, selectedWeek);
    }

    function navigateWeek(direction) {
        let newWeek = currentWeek + direction;

        if (newWeek < 1) newWeek = config.maxWeeks;
        if (newWeek > config.maxWeeks) newWeek = 1;

        $('#weekPicker').val(newWeek).trigger('change');
    }

    function getCurrentAcademicWeek() {
        const now = new Date();
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        const diff = Math.floor((now - startOfYear) / (1000 * 60 * 60 * 24 * 7));
        return (diff % config.maxWeeks) + 1;
    }

    function showLoading() {
        $('#loadingIndicator').show();
    }

    function hideLoading() {
        $('#loadingIndicator').hide();
    }

    function showError(message) {
        $('#errorMessage').text(message).show();
    }

    function handleScheduleError(error) {
        console.error('Ошибка при загрузке расписания:', error);
        let message = 'Ошибка при загрузке расписания';
        if (error.responseJSON && error.responseJSON.error) {
            message = error.responseJSON.error;
        } else if (error.message) {
            message = error.message;
        }
        showError(message);
    }
});
