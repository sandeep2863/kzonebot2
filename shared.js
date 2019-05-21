const WIT_TOKEN = '6YQU5ENYS3SLTGLSLVAY7A7SWWOF2GMG' // TODO: add your wit token here

function firstEntity(entities, name) {
  return entities &&
    entities[name] &&
    Array.isArray(entities[name]) &&
    entities[name] &&
    entities[name][0];
}

module.exports = {
  WIT_TOKEN,
  firstEntity,
};
