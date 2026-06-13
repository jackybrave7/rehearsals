const res = await fetch('http://localhost:3001/api/state');
const s = await res.json();
const playId = s.plays.find((p) => p.title === 'Чайка')?.id;
const scenes = s.scenes.filter((sc) => sc.playId === playId);
console.log('count', scenes.length);
console.log(scenes.slice(0, 5).map((sc) => `${sc.number}. ${sc.title}`).join('\n'));
