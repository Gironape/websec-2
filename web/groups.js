document.addEventListener('DOMContentLoaded', async () => {
    try {
        await initApplication();
        setupEventListeners();
    } catch (error) {
        console.error('Application initialization failed:', error);
        showError('Произошла ошибка при загрузке приложения');
    }
});

async function initApplication() {
    const groups = await fetchGroups();
    populateGroupSelect(groups);
    generateWeekOptions();
    const { groupId, week } = getUrlParams();

    if (groupId) {
        document.getElementById('groupSelect').value = groupId;
    }

    if (week) {
        document.getElementById('weekPicker').value = week;
        updateCurrentWeekDisplay(week);
        updateNavigationButtons(week);
        await loadSchedule();
    } else {
        updateNavigationButtons(1);
    }
}

function setupEventListeners() {
    document.getElementById('groupSelect').addEventListener('change', async () => {
        const weekNumber = document.getElementById('weekPicker').value;
        if (weekNumber) {
            updateCurrentWeekDisplay(weekNumber);
            updateNavigationButtons(weekNumber);
            await loadSchedule();
        }
    });

    document.getElementById('weekPicker').addEventListener('change', async () => {
        const weekNumber = document.getElementById('weekPicker').value;
        if (weekNumber) {
            updateCurrentWeekDisplay(weekNumber);
            updateNavigationButtons(weekNumber);
            await loadSchedule();
        }
    });

    document.getElementById('prevWeek').addEventListener('click', () => {
        navigateWeek(-1);
    });

    document.getElementById('nextWeek').addEventListener('click', () => {
        navigateWeek(1);
    });
}

async function fetchGroups() {
    try {
        const response = await fetch('/api/groups'); 
        console.log('Response status:', response.status);
        console.log('Response ok:', response.ok);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Fetched groups data:', data);
        return data.data;
    } catch (error) {
        console.error('Error fetching groups:', error);
        showError('Не удалось загрузить список групп');
        return [];
    }
}

function populateGroupSelect(groups) {
    const groupSelect = document.getElementById('groupSelect');
    groupSelect.innerHTML = '<option value="">Выберите группу</option>';

    if (Array.isArray(groups)) {
        groups.forEach(group => {
            const option = document.createElement('option');
            option.value = group.id;
            option.textContent = group.name;
            groupSelect.appendChild(option);
        });
    } else {
        console.error('populateGroupSelect: groups is not an array:', groups);
        showError('Ошибка при обработке списка групп');
    }
}

function getUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    return {
        groupId: urlParams.get('groupId'),
        week: urlParams.get('week')
    };
}

function generateWeekOptions() {
    const weekPicker = document.getElementById('weekPicker');
    weekPicker.innerHTML = '<option value="">Выберите неделю</option>';

    for (let i = 1; i <= 52; i++) {
        const option = document.createElement('option');
        option.value = i;
        option.textContent = `${i} неделя`;
        weekPicker.appendChild(option);
    }
}

function updateCurrentWeekDisplay(weekNumber) {
    document.getElementById('currentWeekDisplay').textContent =
        weekNumber ? `Неделя ${weekNumber}` : "Выберите неделю";
}

function updateNavigationButtons(weekNumber) {
    const prevWeek = weekNumber > 1 ? weekNumber - 1 : 52;
    const nextWeek = weekNumber < 52 ? parseInt(weekNumber) + 1 : 1;

    document.getElementById('prevWeek').innerHTML = `&lt; Неделя ${prevWeek}`;
    document.getElementById('nextWeek').innerHTML = `Неделя ${nextWeek} &gt;`;
}

function navigateWeek(direction) {
    let currentWeek = parseInt(document.getElementById('weekPicker').value, 10) || 1;
    let newWeek = currentWeek + direction;

    if (newWeek < 1) newWeek = 52;
    if (newWeek > 52) newWeek = 1;

    document.getElementById('weekPicker').value = newWeek;
    document.getElementById('weekPicker').dispatchEvent(new Event('change'));
}

async function loadSchedule() {
    const weekNumber = document.getElementById('weekPicker').value;
    const groupId = document.getElementById('groupSelect').value;

    console.log('Selected groupId:', groupId);
    console.log('Selected weekNumber:', weekNumber);

    if (!groupId) {
        showError('Выберите группу');
        return;
    }

    if (!weekNumber) {
        showError('Выберите неделю');
        return;
    }

    try {
        showLoading();

        updateBrowserHistory(groupId, weekNumber);
        const data = await loadScheduleData(groupId, weekNumber);

        if (data) {
            renderSchedule(data.dates, data.schedule, data.groupName, data.groupInfo);
        }
    } catch (error) {
        console.error('Error loading schedule:', error);
        showError('Не удалось загрузить расписание');
    } finally {
        hideLoading();
    }
}

async function loadScheduleData(groupId, week) {
    try {
        const url = `/api/schedule?groupId=${groupId}&week=${week}`;
        console.log('Fetching schedule from URL:', url);
        const response = await fetch(url);

        if (!response.ok) {
            if (response.status === 404) {
                throw new Error('Группа не найдена');
            }
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return await response.json();
    } catch (error) {
        console.error('Error fetching schedule:', error);
        throw error;
    }
}

function renderSchedule(dates, scheduleData, groupName, groupInfo) {
    const tableBody = document.getElementById('scheduleBody');
    tableBody.innerHTML = '';

    const days = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
    const times = Object.keys(scheduleData);

    const table = document.getElementById('scheduleTable');
    const thead = table.querySelector('thead');
    thead.innerHTML = '';
    const headerRow = document.createElement('tr');

    const timeHeader = document.createElement('th');
    timeHeader.textContent = 'Время';
    headerRow.appendChild(timeHeader);

    days.forEach((day, index) => {
        const th = document.createElement('th');
        th.textContent = `${day}${dates && dates[index] ? ` (${dates[index]})` : ''}`;
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);

    times.forEach(time => {
        const row = document.createElement('tr');

        const timeCell = document.createElement('td');
        timeCell.textContent = time;
        row.appendChild(timeCell);

        days.forEach(day => {
            const lesson = scheduleData[time][day];
            const td = document.createElement('td');
            td.innerHTML = lesson !== '-' ? lesson : '-';
            row.appendChild(td);
        });

        tableBody.appendChild(row);
    });

    document.querySelector('.header__title').textContent = groupName;
    const groupInfoElement = document.getElementById('groupInfo');
    groupInfoElement.innerHTML = '';
    if (groupInfo) {
        const h2 = document.createElement('h2');
        h2.textContent = groupInfo.title || 'Информация о группе';
        groupInfoElement.appendChild(h2);

        const divDescription = document.createElement('div');
        divDescription.innerHTML = groupInfo.description || 'Нет дополнительной информации';
        groupInfoElement.appendChild(divDescription);

        const divSemesterInfo = document.createElement('div');
        divSemesterInfo.textContent = groupInfo.semesterInfo || '';
        groupInfoElement.appendChild(divSemesterInfo);
    }
}

function updateBrowserHistory(groupId, week) {
    const params = new URLSearchParams({ groupId, week });
    window.history.replaceState({}, '', `?${params.toString()}`);
}

function showLoading() {
    document.getElementById('loadingIndicator').style.display = 'block';
}

function hideLoading() {
    document.getElementById('loadingIndicator').style.display = 'none';
}

function showError(message) {
    const errorElement = document.getElementById('errorMessage');
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    setTimeout(() => errorElement.style.display = 'none', 5000);
}
