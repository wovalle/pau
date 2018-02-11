exports.formatExcercises = (exs) => {
  const status = {
    missing: '🔥',
    done: '💯',
    late: '🕑',
  };

  const batchs = exs.reduce((acc, cur) => {
    acc[cur.batch] = (acc[cur.batch] || []).concat(cur);
    return acc;
  }, {});

  return Object.keys(batchs).reduce((acc, cur) => {
    const rows = batchs[cur].map(ex => `[${ex.name}](${ex.url}) (${status[ex.status]})`);

    // eslint-disable-next-line no-param-reassign
    acc += `*Batch #${cur}* \n${rows.join('\n')}\n\n`;

    return acc;
  }, '');
};
