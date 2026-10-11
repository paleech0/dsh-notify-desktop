const m = await import('file:///E:/DSH%20projects/notification%20plugin/lib/index.js')
console.log('exports:', Object.keys(m).join(', '))
console.log('apply is function:', typeof m.apply === 'function', '| inject:', JSON.stringify(m.inject))
console.log('focus route:', m.FOCUS_ROUTE, '| header:', m.FOCUS_HEADER)
