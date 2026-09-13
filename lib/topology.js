'use strict';

// Mirrors the Cisco Packet Tracer file. Names on the left are the twin's IDs;
// "pt" is the exact label used inside Packet Tracer so the two can be matched.

const VLANS = [
  { id: 10, name: 'Administration', network: '192.168.10.0/24', gateway: '192.168.10.1', pool: 'ADMIN_POOL' },
  { id: 20, name: 'Students', network: '192.168.20.0/24', gateway: '192.168.20.1', pool: 'STUDENTS_POOL' },
  { id: 30, name: 'Faculty', network: '192.168.30.0/24', gateway: '192.168.30.1', pool: 'FACULTY_POOL' },
  { id: 40, name: 'IoT', network: '192.168.40.0/24', gateway: '192.168.40.1', pool: 'IOT_POOL' },
  { id: 50, name: 'Servers', network: '192.168.50.0/24', gateway: '192.168.50.1', pool: 'static' },
  { id: 60, name: 'Guest', network: '192.168.60.0/24', gateway: '192.168.60.1', pool: 'GUEST' },
  { id: 70, name: 'Management', network: '192.168.70.0/24', gateway: '192.168.70.1', pool: 'static' },
];

// x / y are used by the dashboard to draw the topology. 1000 x 520 grid.
const DEVICES = [
  { id: 'ROUTER0',      pt: 'Router0',              type: 'router',   role: 'Edge router',        vlan: null, ip: '—',             x: 600, y: 40  },
  { id: 'CORE-SW',      pt: 'Multilayer Switch0',   type: 'core',     role: 'Core / L3 switch',   vlan: 70,   ip: '192.168.70.1',  x: 600, y: 125 },
  { id: 'SW-ADMIN',     pt: 'Switch7',              type: 'switch',   role: 'Access — admin',     vlan: 10,   ip: '192.168.70.11', x: 120, y: 215 },
  { id: 'SW-USERS',     pt: 'Switch5',              type: 'switch',   role: 'Access — users',     vlan: 20,   ip: '192.168.70.12', x: 380, y: 215 },
  { id: 'SW-SERVERS',   pt: 'Switch6',              type: 'switch',   role: 'Access — servers',   vlan: 50,   ip: '192.168.70.13', x: 680, y: 215 },
  { id: 'SW-WIFI',      pt: 'Switch9',              type: 'switch',   role: 'Access — wireless',  vlan: 60,   ip: '192.168.70.14', x: 1010, y: 215 },
  { id: 'AP-GUEST',     pt: 'AccessPoint GUEST-WIFI', type: 'ap',     role: 'Guest access point', vlan: 60,   ip: '—',             x: 950, y: 305 },
  { id: 'AP-IOT',       pt: 'AccessPoint AP-IOT',   type: 'ap',       role: 'IoT access point',   vlan: 40,   ip: '—',             x: 1110, y: 305 },

  { id: 'PC-ADMIN',     pt: 'PC-Admin',        type: 'pc',     role: 'Admin workstation',  vlan: 10, ip: 'dhcp', x: 65, y: 305 },
  { id: 'PC-ADMIN2',    pt: 'PC-Admin2',       type: 'pc',     role: 'Admin workstation',  vlan: 10, ip: 'dhcp', x: 165, y: 305 },
  { id: 'PC-STUDENT',   pt: 'PC-Student',      type: 'pc',     role: 'Student PC',         vlan: 20, ip: 'dhcp', x: 265, y: 305 },
  { id: 'LT-STUDENT2',  pt: 'Laptop-Student2', type: 'laptop', role: 'Student laptop',     vlan: 20, ip: 'dhcp', x: 360, y: 305 },
  { id: 'PC-FACULTY',   pt: 'PC-Faculty',      type: 'pc',     role: 'Faculty PC',         vlan: 30, ip: 'dhcp', x: 455, y: 305 },
  { id: 'LT-FACULTY2',  pt: 'Laptop-Faculty2', type: 'laptop', role: 'Faculty laptop',     vlan: 30, ip: 'dhcp', x: 550, y: 305 },

  { id: 'SRV-DHCP',     pt: 'Server-DHCP',  type: 'server', role: 'DHCP server', vlan: 50, ip: '192.168.50.10', x: 650, y: 305 },
  { id: 'SRV-WEB',      pt: 'Server-Web',   type: 'server', role: 'Web server',  vlan: 50, ip: '192.168.50.20', x: 745, y: 305 },
  { id: 'SRV-DNS',      pt: 'Server-DNS',   type: 'server', role: 'DNS server',  vlan: 50, ip: '192.168.50.30', x: 840, y: 305 },

  { id: 'PHONE0',       pt: 'Smartphone0',        type: 'mobile', role: 'Guest phone',     vlan: 60, ip: 'dhcp', x: 905, y: 395 },
  { id: 'LT-GUEST',     pt: 'Laptop0',            type: 'laptop', role: 'Guest laptop',    vlan: 60, ip: 'dhcp', x: 1000, y: 395 },
  { id: 'IOT-LIGHT',    pt: 'Smart Light',        type: 'iot',    role: 'Smart light',     vlan: 40, ip: 'dhcp', x: 1100, y: 395 },
  { id: 'IOT-CAM',      pt: 'Webcam IoT2',        type: 'iot',    role: 'Webcam',          vlan: 40, ip: 'dhcp', x: 1195, y: 395 },
  { id: 'IOT-MOTION',   pt: 'Motion Detector IoT22', type: 'iot', role: 'Motion detector', vlan: 40, ip: 'dhcp', x: 1195, y: 450 },
];

// Port numbers read off the Packet Tracer port labels.
const LINKS = [
  { id: 'L1',  a: 'ROUTER0',  aPort: 'Gi0/0',    b: 'CORE-SW',    bPort: 'Fa0/1',  kind: 'uplink' },
  { id: 'L2',  a: 'CORE-SW',  aPort: 'Fa0/2',    b: 'SW-ADMIN',   bPort: 'Fa0/1',  kind: 'uplink' },
  { id: 'L3',  a: 'CORE-SW',  aPort: 'Fa0/3',    b: 'SW-USERS',   bPort: 'Fa0/1',  kind: 'uplink' },
  { id: 'L4',  a: 'CORE-SW',  aPort: 'Fa0/4',    b: 'SW-SERVERS', bPort: 'Fa0/1',  kind: 'uplink' },
  { id: 'L5',  a: 'CORE-SW',  aPort: 'Fa0/5',    b: 'SW-WIFI',    bPort: 'Fa0/1',  kind: 'uplink' },

  { id: 'L6',  a: 'SW-ADMIN', aPort: 'Fa0/2',    b: 'PC-ADMIN',    bPort: 'Fa0', kind: 'access' },
  { id: 'L7',  a: 'SW-ADMIN', aPort: 'Fa0/3',    b: 'PC-ADMIN2',   bPort: 'Fa0', kind: 'access' },

  { id: 'L8',  a: 'SW-USERS', aPort: 'Fa0/2',    b: 'PC-STUDENT',  bPort: 'Fa0', kind: 'access' },
  { id: 'L9',  a: 'SW-USERS', aPort: 'Fa0/3',    b: 'LT-FACULTY2', bPort: 'Fa0', kind: 'access' },
  { id: 'L10', a: 'SW-USERS', aPort: 'Fa0/4',    b: 'PC-FACULTY',  bPort: 'Fa0', kind: 'access' },
  { id: 'L11', a: 'SW-USERS', aPort: 'Fa0/5',    b: 'LT-STUDENT2', bPort: 'Fa0', kind: 'access' },

  { id: 'L12', a: 'SW-SERVERS', aPort: 'Fa0/2',  b: 'SRV-DHCP',    bPort: 'Fa0', kind: 'access' },
  { id: 'L13', a: 'SW-SERVERS', aPort: 'Fa0/3',  b: 'SRV-WEB',     bPort: 'Fa0', kind: 'access' },
  { id: 'L14', a: 'SW-SERVERS', aPort: 'Fa0/4',  b: 'SRV-DNS',     bPort: 'Fa0', kind: 'access' },

  { id: 'L15', a: 'SW-WIFI', aPort: 'Fa0/2',     b: 'AP-GUEST',    bPort: 'Port 0', kind: 'access' },
  { id: 'L16', a: 'SW-WIFI', aPort: 'Fa0/3',     b: 'AP-IOT',      bPort: 'Port 0', kind: 'access' },

  { id: 'L17', a: 'AP-GUEST', aPort: 'wlan',     b: 'PHONE0',      bPort: 'Wireless0', kind: 'wireless' },
  { id: 'L18', a: 'AP-GUEST', aPort: 'wlan',     b: 'LT-GUEST',    bPort: 'Wireless0', kind: 'wireless' },
  { id: 'L19', a: 'AP-IOT',   aPort: 'wlan',     b: 'IOT-LIGHT',   bPort: 'Wireless0', kind: 'wireless' },
  { id: 'L20', a: 'AP-IOT',   aPort: 'wlan',     b: 'IOT-CAM',     bPort: 'Wireless0', kind: 'wireless' },
  { id: 'L21', a: 'AP-IOT',   aPort: 'wlan',     b: 'IOT-MOTION',  bPort: 'Wireless0', kind: 'wireless' },
];

// Every device the university owns. Anything outside this list is unauthorised.
const REGISTRY = DEVICES.map((d) => d.id);

module.exports = { VLANS, DEVICES, LINKS, REGISTRY, ROOT: 'CORE-SW' };
