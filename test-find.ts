const data = [{
  id: 'a',
  children: [{
    id: 'b',
    children: []
  }, {
    id: 'c',
    children: []
  }]
}];

const id = 'c';
const findNode = (nodes: any[]): any | null => {
  for (const n of nodes) {
    if (n.id === id) return n;
    const deeper = findNode(n.children);
    if (deeper) return deeper;
  }
  return null;
};

console.log(findNode(data));
