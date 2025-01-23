/** 
 * @param {(url: string) => Promise<string> | string} resolve
 */
export default function plugin(resolve) {
    return {
        postcssPlugin: 'postcss-url',
        async Once(styles, { result }) {
            const promises = [];
            styles.walkDecls((decl) => {
                if (decl.value.startsWith('url(') && decl.value.endsWith(')')) {
                    let url = decl.value.slice(4, -1);
                    if (url[0] === '"' && url[url.length - 1] === '"' || url[0] === "'" && url[url.length - 1] === "'") {
                        url = url.slice(1, -1);
                    }
                    promises.push(new Promise(async (res, rej) => {
                        try {
                            const content = await resolve(url);
                            decl.value = `url(${JSON.stringify(content)})`;
                            res();
                        } catch (error) {
                            rej(error);
                        }
                    }));
                }
            });
            await Promise.all(promises);
        }
    }
}