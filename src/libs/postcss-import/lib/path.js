export function extname(path) {
    return path.split('.').pop() || '';
}

export function join(...paths) {
    var parts = [];
    for (var i = 0, l = paths.length; i < l; i++) {
        parts = parts.concat(paths[i].split("/"));
    }
    var newParts = [];
    for (i = 0, l = parts.length; i < l; i++) {
        var part = parts[i];
        if (!part || part === ".") continue;
        if (part === "..") newParts.pop();
        else newParts.push(part);
    }
    if (parts[0] === "") newParts.unshift("");
    return newParts.join("/") || (newParts.length ? "/" : ".");
}


export function dirname(path) {
    return join(path, "..");
}

export function isAbsolute(path) {
    return path.charAt(0) === '/';
}