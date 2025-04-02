const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const path = require('path');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'web')));

const GROUP_NUMBER_IDS = {
    "1282690301": "6411-100503D",
    "1282690279": "6412-100503D",
    "1213641978": "6413-100503D"
};

const SSAU_BASE_URL = 'https://ssau.ru/rasp';

async function fetchScheduleHTML(url) {
    try {
        const response = await axios.get(url);
        console.log(`Загружено ${url}:`, response.status, response.statusText);
        return response.data;
    } catch (error) {
        console.error(`Ошибка при загрузке ${url}:`, error.message);
        throw new Error(`Не удалось загрузить schedule из ${url}`);
    }
}

function processSchedule($, week) {
    try {
        const days = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];
        const schedule = {};
        const dates = [];

        $('.schedule__item.schedule__head').each((index, elem) => {
            const date = $(elem).find('.caption-text.schedule__head-date').text().trim();
            if (date) dates.push(date);
        });

        const timeBlocks = $('.schedule__time-item');
        const times = [];
        timeBlocks.each((index, timeElem) => {
            const timeStr = $(timeElem).text().trim();
            if (index % 2 === 0) {
                times.push(`${timeStr} - `);
            } else {
                times[times.length - 1] += timeStr;
            }
        });

        times.forEach((time) => {
            schedule[time] = {};
            days.forEach((day) => {
                schedule[time][day] = '-';
            });
        });

        $('.schedule__item:not(.schedule__head)').each((index, elem) => {
            const cell = $(elem);
            const dayIndex = index % days.length;
            const timeIndex = Math.floor(index / days.length);
            const timeStr = times[timeIndex];

            cell.find('.schedule__lesson').each((_, lessonElem) => {
                try {
                    const lesson = $(lessonElem);
                    const lessonInfo = extractLessonInfo($, lesson, week);
                    if (schedule[timeStr][days[dayIndex]] === '-') {
                        schedule[timeStr][days[dayIndex]] = lessonInfo;
                    } else if (schedule[timeStr][days[dayIndex]] !== '-') {
                        schedule[timeStr][days[dayIndex]] += `<hr>${lessonInfo}</div>`;
                    }
                } catch (lessonError) {
                    console.error('Error while processing lesson:', lessonError.message);
                }
            });
        });
    
        return { days, times, schedule, dates };
    } catch (error) {
        console.error('Error in processSchedule:', error.message);
        throw error;
    }
}

function extractLessonInfo($, lesson, week) {
    try {
        if (!lesson) {
            console.warn('Lesson is null or undefined');
            return '<div>Не удалось получить информацию о занятии</div>';
        }

        const typeClass = lesson.find('.schedule__lesson-type-chip').attr('class') || '';
        const info = lesson.find('.schedule__lesson-info');

        if (!info) {
            console.warn('Info is null or undefined');
            return '<div>Не удалось получить информацию о занятии</div>';
        }
        const subject = info.find('.body-text.schedule__discipline').text().trim();
        const location = info.find('.caption-text.schedule__place').text().trim();

        let teacher = "Преподаватель неизвестен";
        let teacherId = null;
        const teacherLinkElem = info.find('.schedule__teacher a');
        try {
            teacher = teacherLinkElem.text().trim();
            teacherId = teacherLinkElem.attr('href').split('=')[1];
        } catch (e) {
            console.warn("Teacher link not found for this lesson.");
        }

        let groupsHtml = '';
        info.find('a.caption-text.schedule__group').each((_, groupElem) => {
            const groupName = $(groupElem).text().trim();
            const groupIdLink = $(groupElem).attr('href').split('=')[1];
            groupsHtml += `<a href="index.html?groupId=${groupIdLink}&week=${week}" target="_blank">${groupName}</a>, `;
        });

        const groupList = groupsHtml.length > 0 ? groupsHtml.slice(0, -2) : 'Нет групп';

        let lessonInfo = `<b>${subject}</b><br>${location}`;
        if (teacherId) {
            lessonInfo += `<br><a href="teachers.html?staffId=${teacherId}&week=${week}" target="_blank">${teacher}</a>`;
        } else {
            lessonInfo += `<br>${teacher}`;
        }
        lessonInfo += `<br>Группы: ${groupList}`;

        let colorClass = '';
        if (typeClass?.includes('lesson-type-1__bg')) {
            colorClass = 'green';
        } else if (typeClass?.includes('lesson-type-2__bg')) {
            colorClass = 'pink';
        } else if (typeClass?.includes('lesson-type-3__bg')) {
            colorClass = 'blue';
        } else if (typeClass?.includes('lesson-type-4__bg')) {
            colorClass = 'orange';
        } else if (typeClass?.includes('lesson-type-5__bg')) {
            colorClass = 'dark-blue';
        } else if (typeClass?.includes('lesson-type-6__bg')) {
            colorClass = 'turquoise';
        }

        return `<div class="${colorClass}">${lessonInfo}</div>`;
    } catch (error) {
        console.error('Error in extractLessonInfo:', error.message);
        return '<div>Ошибка при обработке занятия</div>';
    }
}



app.get('/api/groups', (req, res) => {
    try {
        const groups = Object.entries(GROUP_NUMBER_IDS).map(([id, name]) => ({
            id,
            name: name.split('-')[0],
        }));
        res.json({ success: true, data: groups });
    } catch (error) {
        console.error("Error fetching groups:", error);
        res.status(500).json({ success: false, error: "Failed to fetch groups" });
    }
});

app.get('/api/schedule', async (req, res) => {
    try {
        const groupId = req.query.groupId;
        const week = req.query.week;

        console.log('Received groupId:', groupId);
        console.log('Received week:', week);

        if (!groupId || !week) {
            return res.status(400).json({ success: false, error: 'Missing groupId or week' });
        }

        if (!GROUP_NUMBER_IDS[groupId]) {
            console.log(`groupId ${groupId} not found in GROUP_NUMBER_IDS`);
            return res.status(404).json({
                success: false,
                error: 'Group not found',
                availableGroups: Object.keys(GROUP_NUMBER_IDS)
            });
        }

        const url = `${SSAU_BASE_URL}?groupId=${groupId}&selectedWeek=${week}`;
        console.log(`Fetching schedule for group from URL: ${url}`);

        const html = await fetchScheduleHTML(url);
        const $ = cheerio.load(html);

        const groupName = $('.page-header h1.h1-text').text().trim();
        if (!groupName) {
            return res.status(404).json({ success: false, error: 'Group not found' });
        }
        const scheduleData = processSchedule($, week); 
        const groupInfoBlock = $('.card-default.info-block');
        let groupDescription = '';
        groupInfoBlock.find('.info-block__description div').each((_, descElem) => {
            groupDescription += $(descElem).text().trim() + '<br>';
        });
        const groupTitle = groupInfoBlock.find('.info-block__title').text().trim();
        const groupSemesterInfo = groupInfoBlock.find('.info-block__semester div').text().trim();

        res.json({
            success: true,
            groupId,
            week,
            groupName,
            groupInfo: {
                title: groupTitle,
                description: groupDescription,
                semesterInfo: groupSemesterInfo
            },
            schedule: scheduleData.schedule,
            dates: scheduleData.dates
        });

    } catch (error) {
        console.error('Error while fetching or processing schedule:', error.message);
        res.status(500).json({ success: false, error: 'Failed to fetch schedule', details: error.message });
    }
});

app.get('/api/teacherSchedule', async (req, res) => {
    try {
        const staffId = req.query.staffId;
        const week = req.query.week;

        console.log(`Received staffId: ${staffId}, week: ${week}`);

        if (!staffId || !week) {
            return res.status(400).json({ success: false, error: 'Missing staffId or week' });
        }

        const url = `${SSAU_BASE_URL}?staffId=${staffId}&selectedWeek=${week}`;
        console.log(`Fetching teacher schedule from URL: ${url}`);

        const html = await fetchScheduleHTML(url);
        const $ = cheerio.load(html);

        const teacherName = $('.page-header h1.h1-text').text().trim();
        if (!teacherName) {
            return res.status(404).json({ success: false, error: 'Teacher not found' });
        }
        const scheduleData = processSchedule($, week);

        res.json({
            success: true,
            staffId,
            week,
            teacherName,
            schedule: scheduleData.schedule,
            dates: scheduleData.dates
        });

    } catch (error) {
        console.error('Error while fetching or processing teacher schedule:', error.message);
        res.status(500).json({ success: false, error: 'Failed to fetch teacher schedule', details: error.message });
    }
});

app.get('/api/teacherInfo', async (req, res) => {
    try {
        const staffId = req.query.staffId;
        console.log("Получен staffId:", staffId);

        if (!staffId) {
            return res.status(400).json({ success: false, error: 'Missing staffId' });
        }

        const url = `${SSAU_BASE_URL}?staffId=${staffId}`;
        console.log(`Fetching teacher info from URL: ${url}`);

        const html = await fetchScheduleHTML(url);
        const $ = cheerio.load(html);
        let teacherName = $('.page-header h1.h1-text').text().trim();
        teacherName = teacherName.replace('Расписание, ', '');
        console.log(`Teacher name: ${teacherName}`);

        if (!teacherName) {
            return res.status(404).json({ success: false, error: 'Teacher not found' });
        }

        const teacherInfoBlock = $('.card-default.info-block');
        let teacherDescription = '';
        teacherInfoBlock.find('.info-block__description div').each((_, descElem) => {
            teacherDescription += $(descElem).text().trim() + '<br>';
        });
        console.log(`Teacher description: ${teacherDescription}`);
        let semesterInfo = teacherInfoBlock.find('.info-block__semester div').text().trim();
        teacherDescription += `<br>${semesterInfo}`;

        res.json({
            success: true,
            staffId,
            teacherName,
            teacherInfo: teacherDescription
        });

    } catch (error) {
        console.error('Error while fetching or processing teacher info:', error.message);
        res.status(500).json({ success: false, error: 'Failed to fetch teacher info', details: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});
