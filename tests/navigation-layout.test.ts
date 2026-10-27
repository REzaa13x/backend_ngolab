import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const layout = readFileSync('src/components/Layout.tsx', 'utf8');
const sidebar = readFileSync('src/components/Sidebar.tsx', 'utf8');

test('navigasi mobile dapat dibuka dan ditutup tanpa menghilangkan menu desktop', () => {
  assert.match(layout, /aria-label="Buka navigasi"/);
  assert.match(layout, /aria-controls="main-navigation"/);
  assert.match(layout, /mobileOpen={mobileNavOpen} onCloseMobile=/);
  assert.match(layout, /event\.key === 'Escape'/);
  assert.match(sidebar, /mobileOpen \? 'flex' : 'hidden'/);
  assert.match(sidebar, /md:relative md:flex/);
  assert.match(sidebar, /onClick=\{\(\) => \{ setActiveTab\(item\.id\); onCloseMobile\(\); \}\}/);
});

test('menu aktif dan kontrol ringkas memiliki label yang dapat diakses', () => {
  assert.match(sidebar, /aria-current=\{activeTab === item\.id \? 'page' : undefined\}/);
  assert.match(sidebar, /aria-label=\{item\.label\}/);
  assert.match(sidebar, /aria-label=\{isCollapsed \? 'Perluas navigasi' : 'Ringkas navigasi'\}/);
  assert.doesNotMatch(sidebar, /hidden md:flex[^"\n]*rounded-full flex /, 'kontrol ringkas harus tersembunyi pada mobile');
});
