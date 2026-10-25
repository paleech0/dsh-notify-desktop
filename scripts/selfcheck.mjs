const m = await import(new URL('../lib/index.js', import.meta.url))
console.log('exports:', Object.keys(m).join(', '))
console.log('apply is function:', typeof m.apply === 'function', '| inject:', JSON.stringify(m.inject))
console.log('focus route:', m.FOCUS_ROUTE, '| header:', m.FOCUS_HEADER)
