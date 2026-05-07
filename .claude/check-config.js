const cs = require('C:/Users/ACER/AppData/Roaming/npm/node_modules/firebase-tools/lib/configstore');
console.log('store path:', cs.configstore.path);
console.log('all keys:', JSON.stringify(Object.keys(cs.configstore.all)));
const user = cs.configstore.get('user');
const tok  = cs.configstore.get('tokens');
console.log('user:', user ? user.email : 'none');
console.log('tokens:', tok ? 'YES' : 'none');
if (tok) console.log('refresh_token:', tok.refresh_token ? tok.refresh_token.substring(0,30)+'...' : 'none');
