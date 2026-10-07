// Dictionary: Thai source text -> [English, Burmese, Khmer]. "{n}" stands for a number.
const modules = import.meta.glob("./part*.js", { eager: true });
const dictionary = {};
Object.keys(modules).sort().forEach((k) => Object.assign(dictionary, modules[k].default));
export default dictionary;
