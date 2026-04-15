'use strict';

function splitLines(value) {
  return value ? value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean) : [];
}

function includesPath(changedFiles, prefix) {
  return changedFiles.some((file) => file === prefix.slice(0, -1) || file.startsWith(prefix));
}

function includesFile(changedFiles, filePath) {
  return changedFiles.includes(filePath);
}

module.exports = {
  includesFile,
  includesPath,
  splitLines,
};
