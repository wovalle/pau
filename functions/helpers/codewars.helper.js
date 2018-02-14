const moment = require('moment');

exports.diffExcercises = (fbExcercises, codewars) => {
  const exercises = Object.assign({}, fbExcercises);

  codewars
    .filter(ex => ex.completedLanguages.includes('python'))
    .forEach((ex) => {
      if (exercises[ex.slug]) {
        exercises[ex.slug].completedAt = ex.completedAt ? moment(ex.completedAt) : null;
        exercises[ex.slug].completedLanguages = ex.completedLanguages;
      }
    });

  return Object.keys(exercises).map((slug) => {
    const currentEx = exercises[slug];
    // eslint-disable-next-line no-nested-ternary
    currentEx.status = currentEx.completedAt ?
      moment(currentEx.due_date.replace(/\//g, '-')).endOf('day') > currentEx.completedAt ? 'done' : 'late' : 'missing';
    return currentEx;
  });
};
