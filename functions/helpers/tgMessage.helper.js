const get = require('lodash.get');
const moment = require('moment');

exports.flattenTgMessage = (message) => {
  const entity = get(message, 'entities.0', { offset: 0, length: 0 });
  const text = get(message, 'text', '').slice(1);
  return Object.assign({
    text,
    isBotCommand: get(entity, 'type') === 'bot_command',
    command: text.slice(entity.offset, entity.length).trim(),
    chatId: get(message, 'chat.id'),
    fromId: get(message, 'from.id'),
    fromUsername: get(message, 'from.username'),
    messageId: get(message, 'message_id'),
    date: new Date(message.date),
  });
};

exports.codewarsExercises = (exercises) => {
  const status = {
    missing: '🔥',
    done: '💯',
    late: '🕑',
  };

  const batchs = exercises.reduce((acc, cur) => {
    acc[cur.batch] = (acc[cur.batch] || []).concat(cur);
    return acc;
  }, {});

  return Object.keys(batchs).reduce((acc, cur) => {
    const rows = batchs[cur].map((ex) => {
      const formattedDate = ex.completedAt ? moment(ex.completedAt).format('DD/MM HH:mm') : '☠️';
      return `[${ex.name}](${ex.url}) *(${formattedDate})* (${status[ex.status]})`;
    });

    // eslint-disable-next-line no-param-reassign
    acc += `*Batch #${cur}* \n${rows.join('\n')}\n\n`;

    return acc;
  }, '');
};

exports.genericError = () => 'An error has occurred, please contact the administrator';
