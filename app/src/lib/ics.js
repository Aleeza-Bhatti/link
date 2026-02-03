const unfoldLines = (text) => {
  const lines = text.split(/\r?\n/);
  const unfolded = [];
  for (const line of lines) {
    if (line.startsWith(' ') || line.startsWith('\t')) {
      const last = unfolded.pop() || '';
      unfolded.push(last + line.trim());
    } else {
      unfolded.push(line.trim());
    }
  }
  return unfolded;
};

const parseDateTime = (value) => {
  if (!value) return null;
  const isUtc = value.endsWith('Z');
  const clean = isUtc ? value.slice(0, -1) : value;
  const dateOnly = /^\d{8}$/.test(clean);
  if (dateOnly) {
    const year = Number(clean.slice(0, 4));
    const month = Number(clean.slice(4, 6)) - 1;
    const day = Number(clean.slice(6, 8));
    return new Date(year, month, day);
  }
  const match = clean.match(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})?/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const min = Number(match[5]);
  const sec = Number(match[6] || '0');
  if (isUtc) {
    return new Date(Date.UTC(year, month, day, hour, min, sec));
  }
  return new Date(year, month, day, hour, min, sec);
};

const toDayIndex = (date) => {
  const js = date.getDay();
  return (js + 6) % 7;
};

const toTimeString = (date) => {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
};

const looksLikeCourseCode = (text) => {
  if (!text) return false;
  return /\b[A-Z]{2,5}\s?\d{3}[A-Z]?\b/i.test(text);
};

const isLikelyClass = (summary, startDate, endDate, rrule) => {
  const text = (summary || '').toLowerCase();
  const blocklist = [
    'assignment',
    'homework',
    'quiz',
    'exam',
    'midterm',
    'final',
    'due',
    'submission',
    'reading',
    'project',
    'grade',
    'office hours',
  ];

  if (blocklist.some((word) => text.includes(word))) {
    return false;
  }

  if (!startDate || !endDate) return false;
  const durationMins = (endDate - startDate) / (1000 * 60);
  if (durationMins < 30 || durationMins > 240) return false;

  if (rrule) return true;

  return looksLikeCourseCode(summary);
};

const parseIcsToClasses = (icsText) => {
  const lines = unfoldLines(icsText);
  const events = [];
  let current = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      current = {};
    } else if (line === 'END:VEVENT') {
      if (current?.dtstart && current?.dtend) {
        events.push(current);
      }
      current = null;
    } else if (current) {
      if (line.startsWith('DTSTART')) {
        const value = line.split(':').slice(1).join(':');
        current.dtstart = value;
      } else if (line.startsWith('DTEND')) {
        const value = line.split(':').slice(1).join(':');
        current.dtend = value;
      } else if (line.startsWith('SUMMARY')) {
        current.summary = line.split(':').slice(1).join(':');
      } else if (line.startsWith('RRULE')) {
        current.rrule = line.split(':').slice(1).join(':');
      }
    }
  }

  return events
    .map((event) => {
      const startDate = parseDateTime(event.dtstart);
      const endDate = parseDateTime(event.dtend);
      if (!startDate || !endDate) return null;
      const dateOnlyStart = /^\d{8}$/.test(event.dtstart || '');
      const dateOnlyEnd = /^\d{8}$/.test(event.dtend || '');
      if (dateOnlyStart || dateOnlyEnd) return null;
      if (!isLikelyClass(event.summary, startDate, endDate, event.rrule)) return null;
      return {
        title: (event.summary || 'Class').trim(),
        day: toDayIndex(startDate),
        start_time: toTimeString(startDate),
        end_time: toTimeString(endDate),
      };
    })
    .filter(Boolean)
    .filter((event, index, list) => {
      const key = `${event.title}|${event.day}|${event.start_time}|${event.end_time}`;
      return list.findIndex((item) => (
        `${item.title}|${item.day}|${item.start_time}|${item.end_time}` === key
      )) === index;
    });
};

const computeFreeBlocks = (classes, startHour = 8, endHour = 20) => {
  const blocksByDay = new Map();
  classes.forEach((block) => {
    const list = blocksByDay.get(block.day) || [];
    list.push(block);
    blocksByDay.set(block.day, list);
  });

  const free = [];
  for (let day = 0; day < 7; day += 1) {
    const blocks = (blocksByDay.get(day) || []).slice();
    blocks.sort((a, b) => a.start_time.localeCompare(b.start_time));

    let cursor = `${String(startHour).padStart(2, '0')}:00:00`;
    const endLimit = `${String(endHour).padStart(2, '0')}:00:00`;

    for (const block of blocks) {
      if (block.start_time > cursor) {
        free.push({ day, start_time: cursor, end_time: block.start_time });
      }
      if (block.end_time > cursor) {
        cursor = block.end_time;
      }
    }

    if (cursor < endLimit) {
      free.push({ day, start_time: cursor, end_time: endLimit });
    }
  }
  return free;
};

module.exports = { parseIcsToClasses, computeFreeBlocks };
