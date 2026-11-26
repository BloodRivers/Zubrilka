export function repeatWrong(queue, item) {
  for (let n = 0; n < 2; n++) {
    const pos = Math.min(queue.length, Math.floor(Math.random() * (Math.min(8, queue.length) + 1)));
    queue.splice(pos, 0, item);
  }
}
