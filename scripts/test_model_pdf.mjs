import { parseCalendarText } from '../lib/pdf/extractor.ts';

const text = `
BA
B
I
O
S
SUNDAY MONDAY TUESDAY WEDNESDAY THURSDAY FRIDAY SATURDAY
1
pin poster 1
2
pin poster 2
3
pin poster 3
4 5 6 7
Motion
graphics [1]
8
9 10 11
poster 4
12 13 14 15
poster 4
[independence day ]
16
Scripted [1]
17 18 19 20 21 22
Motion graphics
23 24 25
poster 5
[onam]
26 27 28
poster 6
29
30
Scripted [2]
31
`;

const res = parseCalendarText(text, { defaultMonth: 8, defaultYear: 2026 });
console.log('Detected tasks (' + res.tasks.length + '):');
res.tasks.forEach(t => console.log(`${t.task_date} => ${t.task_name} | Reminder: ${t.reminder_date}`));
