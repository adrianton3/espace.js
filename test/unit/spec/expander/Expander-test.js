describe('Expander', function () {
	const tokenizer = espace.Tokenizer()

	const parse = function (text) {
		return espace.Parser.parse(tokenizer(text))
	}

	const processForRest = espace.Expander.processForRest


	describe('extract', function () {
		const extract = espace.Expander.extract

		it('matches a simple expression', function () {
			const source = parse('(+ a b)')
			const pattern = parse('(+ a b)')
			expect(extract(source, pattern)).toBeTruthy()
		})

		it('rejects a simple expression', function () {
			const source = parse('(+ a b)')
			const pattern = parse('(- a b)')
			expect(extract(source, pattern)).toBeNull()
		})

		it('rejects an expression with different parens', function () {
			const source = parse('(+ a b)')
			const pattern = parse('[+ a b]')
			expect(extract(source, pattern)).toBeNull()
		})

		it('rejects when trying to match a atom with an expression', function () {
			const source = parse('a')
			const pattern = parse('(+ a b)')
			expect(extract(source, pattern)).toBeNull()
		})

		it('matches a complex expression with one-to-one correspondence', function () {
			const source = parse('(+ a (- b c))')
			const pattern = parse('(+ a (- b c))')
			expect(extract(source, pattern)).toBeTruthy()
		})

		it('matches a complex expression', function () {
			const source = parse('(+ a (- b c))')
			const pattern = parse('(+ a b)')
			expect(extract(source, pattern)).toBeTruthy()
		})

		it('matches a complex expression with multiple paren types', function () {
			const source = parse('[+ a {- b c}]')
			const pattern = parse('[+ a b]')
			expect(extract(source, pattern)).toBeTruthy()
		})

		it('extracts values from a simple expression', function () {
			const source = parse('(+ 123 a)')
			const pattern = parse('(+ x y)')

			const map = extract(source, pattern)
			expect(map).toBeTruthy()
			expect(map.x).toEqual(parse('123'))
			expect(map.y).toEqual(parse('a'))
		})

		it('extracts values from a complex expression with one-to-one correspondence', function () {
			const source = parse('(+ 123 (- a "asd"))')
			const pattern = parse('(+ x (- y z))')

			const map = extract(source, pattern)
			expect(map).toBeTruthy()
			expect(map.x).toEqual(parse('123'))
			expect(map.y).toEqual(parse('a'))
			expect(map.z).toEqual(parse('"asd"'))
		})

		it('extracts values from a complex expression', function () {
			const source = parse('(+ 123 (- a "asd"))')
			const pattern = parse('(+ x y)')

			const map = extract(source, pattern)
			expect(map).toBeTruthy()
			expect(map.x).toEqual(parse('123'))
			expect(map.y).toEqual(parse('(- a "asd")'))
		})

		it('extracts a rest parameter', function () {
			const source = parse('(+ a b c)')
			const pattern = parse('(+ x...)')
			processForRest(pattern)

			const map = extract(source, pattern)
			expect(map).toBeTruthy()
			expect(map['x...']).toEqual([parse('a'), parse('b'), parse('c')])
		})

		it('extracts a rest parameter when surrounded by other tokens', function () {
			const source = parse('(+ a b c d e)')
			const pattern = parse('(+ x y... z)')
			processForRest(pattern)

			const map = extract(source, pattern)
			expect(map).toBeTruthy()
			expect(map.x).toEqual(parse('a'))
			expect(map['y...']).toEqual([parse('b'), parse('c'), parse('d')])
			expect(map.z).toEqual(parse('e'))
		})
	})


	describe('deepClone', function () {
		const deepClone = espace.Expander.deepClone

		it('clones atoms', function () {
			let expression = parse('asd')
			expect(deepClone(expression)).toEqual(expression)

			expression = parse('123')
			expect(deepClone(expression)).toEqual(expression)

			expression = parse('"asd"')
			expect(deepClone(expression)).toEqual(expression)
		})

		it('clones an empty expression', function () {
			const expression = parse('()')
			expect(deepClone(expression)).toEqual(expression)
		})

		it('clones a simple expression', function () {
			const expression = parse('(a)')
			expect(deepClone(expression)).toEqual(expression)
		})

		it('clones a single-level expression', function () {
			const expression = parse('(a b c)')
			expect(deepClone(expression)).toEqual(expression)
		})

		it('clones a multi-level expression', function () {
			const expression = parse('(a (b c) d)')
			expect(deepClone(expression)).toEqual(expression)
		})

		it('clones a multi-level expression with multiple paren types', function () {
			const expression = parse('(a [b {c}] d)')
			expect(deepClone(expression)).toEqual(expression)
		})
	})


	describe('inject', function () {
		const inject = function (source, map, suffixes) {
			suffixes = suffixes || {}
			espace.Expander.inject(source, map, suffixes)
		}

		it('injects a variable into a single atom', function () {
			const source = parse('a')
			const map = { a: parse('b') }
			inject(source, map)
			expect(source).toEqual(parse('b'))
		})

		it('injects a variable into a single-level expression', function () {
			const source = parse('(+ a c)')
			const map = { a: parse('b') }
			inject(source, map)
			expect(source).toEqual(parse('(+ b c)'))
		})

		it('injects a variable into a multi-level expression', function () {
			const source = parse('(+ a (- c d) e)')
			const map = { c: parse('b') }
			inject(source, map)
			expect(source).toEqual(parse('(+ a (- b d) e)'))
		})

		it('injects a tree into an expression', function () {
			const source = parse('(+ a e)')
			const map = {
				a: parse('(- b c)'),
				e: parse('(- f g)'),
			}
			inject(source, map)
			expect(source).toEqual(parse('(+ (- b c) (- f g))'))
		})

		it('injects a rest term into an expression', function () {
			const source = parse('(+ a z...)')
			const map = {
				'z...': [parse('b'), parse('c')],
			}
			inject(source, map)
			const expected = parse('(+ a b c)')
			expect(source).toEqual(expected)
		})

		it('injects two rest terms into an expression', function () {
			const source = parse('(+ x... y...)')
			const map = {
				'x...': [parse('a'), parse('b')],
				'y...': [parse('c'), parse('d')],
			}
			inject(source, map)
			const expected = parse('(+ a b c d)')
			expect(source).toEqual(expected)
		})

		it('generates a unique name for a prefixed identifier', function () {
			const source = parse('(+ _a)')
			const map = {}
			const suffixes = {}
			inject(source, map, suffixes)
			const expected = parse('(+ _a_0)')
			expect(source).toEqual(expected)
		})

		it('generates a unique name for a prefixed identifier and uses it consistently', function () {
			const source = parse('(+ _a _a)')
			const map = {}
			const suffixes = {}
			inject(source, map, suffixes)
			const expected = parse('(+ _a_0 _a_0)')
			expect(source).toEqual(expected)
		})
	})


	describe('processForRest', function () {
		const processForRest = function (text) {
			const tree = parse(text)
			return espace.Expander.processForRest(tree)
		}

		const parseAndRest = function (text, before, after, name) {
			const tree = parse(text)
			tree.rest = {
				before,
				after,
				name,
			}
			return tree
		}

		const tokenA = function (value) {
			return {
				type: 'atom',
				token: {
					type: 'identifier',
					value,
				},
			}
		}

		const tokenP = function (rest) {
			const tree = {
				type: 'list',
				token: {
					type: 'open',
					value: '(',
				},
				children: Array.prototype.slice.call(arguments, 1),
			}
			if (rest) {
				tree.rest = rest
			}
			return tree
		}

		it('does not affect expressions that don\'t contain rest parameters', function () {
			const source = '(+ a b c)'
			const tree = processForRest(source)
			expect(tree).toEqual(parse(source))
		})

		it('matches the rest token in a simple expression', function () {
			const source = '(+ a...)'
			const tree = processForRest(source)
			expect(tree).toEqual(parseAndRest(source, 0, 0, 'a...'))
		})

		it('matches the rest token in a simple expression when it is not the first', function () {
			const source = '(+ a b c...)'
			const tree = processForRest(source)
			expect(tree).toEqual(parseAndRest(source, 2, 0, 'c...'))
		})

		it('matches the rest token in a simple expression when it is not the last', function () {
			const source = '(+ a... b c)'
			const tree = processForRest(source)
			expect(tree).toEqual(parseAndRest(source, 0, 2, 'a...'))
		})

		it('matches the rest token in a simple expression when it is not the first nor the last', function () {
			const source = '(+ a b... c d)'
			const tree = processForRest(source)
			expect(tree).toEqual(parseAndRest(source, 1, 2, 'b...'))
		})

		it('matches the rest tokens in a nested expression', function () {
			const source = '(+ a b... (- c... d))'
			const tree = processForRest(source)

			expect(tree).toEqual(tokenP({
				before: 1,
				after: 1,
				name: 'b...',
			},
			tokenA('+'),
			tokenA('a'),
			tokenA('b...'),
			tokenP({
				before: 0,
				after: 1,
				name: 'c...',
			},
			tokenA('-'),
			tokenA('c...'),
			tokenA('d')
			)
			))
		})
	})


	describe('validatePattern', function () {
		const validate = function (source) {
			const tree = parse(source)
			return espace.Expander.validatePattern.bind(null, tree)
		}

		beforeEach(function () {
			jasmine.addMatchers(meta.CustomMatchers)
		})

		it('throws an exception when a pattern expression starts with non-identifiers', function () {
			expect(validate('(123 a b)'))
				.toThrowWithMessage('Tokens of type number are not allowed in patterns')
			expect(validate('("asd" a b)'))
				.toThrowWithMessage('Tokens of type string are not allowed in patterns')
		})

		it('throws an exception when a pattern contains non-identifiers', function () {
			expect(validate('(+ a 123)'))
				.toThrowWithMessage('Tokens of type number are not allowed in patterns')
			expect(validate('(+ a "asd")'))
				.toThrowWithMessage('Tokens of type string are not allowed in patterns')
		})

		it('throws an exception when a pattern contains the same variable twice', function () {
			expect(validate('(+ a a)'))
				.toThrowWithMessage('Variable "a" already used in pattern')
		})

		it('throws an exception when a pattern contains more rest variables on the same level', function () {
			expect(validate('(+ a... (+ b c) d...)'))
				.toThrowWithMessage('Pattern can contain at most one rest variable on a level')
		})

		it('throws an exception when a pattern containes a prefixed variable', function () {
			expect(validate('(+ a b _c)'))
				.toThrowWithMessage('Pattern can not contain variables prefixed by \'_\'')
		})
	})


	describe('expand', function () {
		const expand = function (source, pattern, replacement) {
			const sourceTree = parse(source)

			espace.Expander.expand(
				sourceTree,
				parse(pattern),
				parse(replacement)
			)

			return sourceTree
		}

		it('expands an atom', function () {
			const source = expand('(++ a)', '(++ x)', '(+ x 1)')
			expect(source).toEqual(parse('(+ a 1)'))
		})

		it('rewrites an expression', function () {
			const source = expand('(+ a b c)', '(+ x y z)', '(+ x (+ y z))')
			expect(source).toEqual(parse('(+ a (+ b c))'))
		})

		it('rewrites a complex expression', function () {
			const source = expand('(- m (+ a b c) n)', '(+ x y z)', '(+ x (+ y z))')
			expect(source).toEqual(parse('(- m (+ a (+ b c)) n)'))
		})

		it('rewrites a simple expression with a rest term', function () {
			const source = expand('(+ a b c)', '(+ x...)', '(- x...)')
			expect(source).toEqual(parse('(- a b c)'))
		})

		it('rewrites a longer expression with a rest term', function () {
			const source = expand('(+ a b c d e)', '(+ x y... z)', '(- z y... x)')
			expect(source).toEqual(parse('(- e b c d a)'))
		})

		it('rewrites a nested expression with rest terms', function () {
			const source = expand('(+ a b (+ c d))', '(+ x... (+ y...))', '(+ (+ x...) y...)')
			expect(source).toEqual(parse('(+ (+ a b) c d)'))
		})

		it('generates a unique name for a prefixed identifier', function () {
			const source = expand('(+ a b)', '(+ x y)', '(+ x _z)')
			expect(source).toEqual(parse('(+ a _z_0)'))
		})

		it('generates a unique name for a prefixed identifier and uses it consistently', function () {
			const source = expand('(+ a b)', '(+ x y)', '(+ _z _z)')
			expect(source).toEqual(parse('(+ _z_0 _z_0)'))
		})

		it('generates a unique name for a prefixed identifier in different matches', function () {
			const source = expand('(- (+ a b) (+ c d))', '(+ x y)', '(+ x _z)')
			expect(source).toEqual(parse('(- (+ a _z_0) (+ c _z_1))'))
		})

		it('generates a unique name for a prefixed identifier even if it\'s the first child', function () {
			const source = expand('(swap a b)', '(swap x y)', '(let (_tmp x) (set! x y) (set! y _tmp))')
			expect(source).toEqual(parse('(let (_tmp_0 a) (set! a b) (set! b _tmp_0))'))
		})
	})
})
