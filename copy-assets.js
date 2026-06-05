const fs = require('fs');
const path = require('path');

const brain = 'C:\\Users\\Christian NGK\\.gemini\\antigravity-ide\\brain\\a14fe968-65b5-406f-a65d-8091be932e15';
const pub = 'C:\\RESERVOIR\\Apps Dev\\FIRST AI\\skild-ai\\public';

// Ensure dirs exist
fs.mkdirSync(path.join(pub, 'icons'), { recursive: true });
fs.mkdirSync(path.join(pub, 'bots'), { recursive: true });

// Copy icon
const icon = path.join(brain, 'skild_ai_icon_1780421296349.png');
fs.copyFileSync(icon, path.join(pub, 'icons', 'icon-192.png'));
fs.copyFileSync(icon, path.join(pub, 'icons', 'icon-512.png'));
console.log('Icons copied OK');

// Copy robot image
const robot = path.join(brain, 'bot_robot_gam1_1780420503257.png');
fs.copyFileSync(robot, path.join(pub, 'bots', 'robot.png'));
console.log('Robot image copied OK');
