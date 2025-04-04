import { fileURLToPath } from 'node:url'

import { expect as baseExpect, test as baseTest, type Locator, type Page } from '@playwright/test'
import { build, preview } from 'astro'

process.env['ASTRO_DISABLE_UPDATE_CHECK'] = 'true'
process.env['ASTRO_TELEMETRY_DISABLED'] = 'true'

export function testFactory(fixture: string) {
  async function createPreviewServer(): Promise<PreviewServer> {
    const root = fileURLToPath(new URL(`fixtures/${fixture}`, import.meta.url))
    await build({ logLevel: 'error', root })
    return preview({ logLevel: 'error', root })
  }

  let previewServer: PreviewServer | undefined

  const test = baseTest.extend<TestFixtures>({
    getPage: ({ page }, use) =>
      use(async () => {
        const server = (previewServer ??= await createPreviewServer())
        return new StarlightPage(page, server)
      }),
  })

  test.afterAll(async () => {
    await previewServer?.stop()
  })

  return test
}

export const expect = baseExpect.extend({
  toMatchSidebar(items: TestSidebarItem[], expected: TestSidebarItem[]) {
    let pass = false
    const assertionName = 'toMatchSidebar'
    let matcherResult: MatcherResult | undefined

    try {
      baseExpect(items).toMatchObject(expected)
      pass = true
    } catch (error: unknown) {
      if (isMatcherResultError(error)) matcherResult = error.matcherResult
    }

    return {
      expected,
      message: () =>
        matcherResult?.message ?? this.utils.matcherHint(assertionName, undefined, undefined, { isNot: this.isNot }),
      name: assertionName,
      pass,
    }
  },
})

class StarlightPage {
  constructor(
    public readonly page: Page,
    private readonly server: PreviewServer,
  ) {}

  go() {
    return this.goTo('/')
  }

  goTo(url: string) {
    return this.page.goto(this.#resolveUrl(url))
  }

  #resolveUrl(url: string) {
    return `http://localhost:${this.server.port}${url}`
  }

  async getSidebarGroupState(labelSegments: TestSidebarItemGroupLabelSegments) {
    const open = await this.#getSidebarGroupDetails(labelSegments).getAttribute('open')

    return open === null ? 'collapsed' : 'expanded'
  }

  async getSidebarGroupBadge(labelSegments: TestSidebarItemGroupLabelSegments) {
    const badge = this.#getSidebarGroupDetails(labelSegments).locator('> summary .sl-badge')
    const isVisible = await badge.isVisible()
    if (!isVisible) return null

    const text = await badge.textContent()
    const classes = await badge.evaluate((element) => [...element.classList])
    const variant =
      classes.find((className) => ['note', 'danger', 'success', 'caution', 'tip'].includes(className)) ?? 'default'

    return { text, variant }
  }

  getSidebarGroupItems(label: string) {
    return this.#getSidebarGroupItemFromList(this.#getSidebarGroupList(label))
  }

  async expectPrevNextLinks(group: string, assertions: TestPrevNextAssertions, locale?: string) {
    for (const { expected, url } of assertions) {
      await this.goTo(`${locale ? `/${locale}` : ''}/${group}${url}`)

      for (const type of ['prev', 'next'] as const) {
        const expectedPrevNextLink = expected[type]
        if (expectedPrevNextLink !== undefined) {
          if (expectedPrevNextLink === null) {
            await expect(this.page.locator(`a[rel="${type}"]`)).not.toBeVisible()
          } else {
            const prevNextLink = await this.#getPrevNextLink(type)
            expect(prevNextLink).toEqual(expectedPrevNextLink)
          }
        }
      }
    }
  }

  async #getPrevNextLink(type: 'prev' | 'next'): Promise<TestPrevNextLink> {
    const link = this.page.locator(`a[rel="${type}"]`)
    const href = await link.getAttribute('href')
    const label = await link.locator('.link-title').textContent()

    if (!href || !label) {
      throw new Error(`Failed to find ${type} link`)
    }

    return { href, label }
  }

  get #sidebar() {
    return this.page.locator('nav div.sidebar-content')
  }

  #getSidebarGroupList(label: string) {
    return this.#sidebar.getByRole('listitem').locator(this.#getSidebarGroupSelector(label)).last().locator('> ul')
  }

  async #getSidebarGroupItemFromList(groupList: Locator) {
    const items: TestSidebarItem[] = []

    for (const item of await groupList.locator('> li > :is(a, details)').all()) {
      const href = await item.getAttribute('href')

      if (href) {
        const label = await item.textContent()
        items.push({ label: label?.trim() })
      } else {
        const label = await item.locator(`> summary > div > span`).first().textContent()
        items.push({
          label: label?.trim(),
          items: await this.#getSidebarGroupItemFromList(item.locator('> ul')),
        })
      }
    }

    return items
  }

  #getSidebarGroupDetails(labelSegments: [string, ...string[]]) {
    let details: Locator | undefined

    for (const label of labelSegments) {
      const root = details ?? this.#sidebar.getByRole('listitem')
      details = root.locator(this.#getSidebarGroupSelector(label))
    }

    if (!details) {
      throw new Error(`At least one label segment must be provided for a sidebar group.`)
    }

    return details
  }

  #getSidebarGroupSelector(label: string) {
    return `details:has(summary > div > span:text-is("${label}"))`
  }
}

function isMatcherResultError(error: unknown): error is MatcherResultError {
  return typeof error === 'object' && error !== null && 'matcherResult' in error
}

interface TestFixtures {
  getPage: () => Promise<StarlightPage>
}

interface MatcherResult {
  message: string
  pass: boolean
}

interface MatcherResultError {
  matcherResult: MatcherResult
}

type PreviewServer = Awaited<ReturnType<typeof preview>>

type TestSidebarItem = TestSidebarItemGroup | TestSidebarItemLink

interface TestSidebarItemGroup {
  items: (TestSidebarItemGroup | TestSidebarItemLink)[]
  label: string | undefined
}

interface TestSidebarItemLink {
  label: string | undefined
}

interface TestPrevNextLink {
  href: string
  label: string
}

type TestPrevNextAssertions = {
  url: string
  expected: {
    // Use `null` to assert that the link does not exist.
    prev?: TestPrevNextLink | null
    next?: TestPrevNextLink | null
  }
}[]

type TestSidebarItemGroupLabelSegments = [string, ...string[]]
