export function join(...paths: string[]) {
    var parts: string[] = [];
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

export function dirname(path: string) {
    return join(path, "..");
}