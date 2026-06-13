const res = await fetch('http://localhost:3001/api/state');
const s = await res.json();
const plays = s.plays.filter((p) => p.title.includes('Чайка') || p.title.includes('чайка'));
console.log(JSON.stringify({
  activeTheaterId: s.activeTheaterId,
  theaters: s.theaters,
  plays,
  roles: s.playRoles.filter((r) => plays.some((p) => p.id === r.playId)),
  scenes: s.scenes.filter((sc) => plays.some((p) => p.id === sc.playId)),
}, null, 2));
