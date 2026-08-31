import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { Button } from '../Button'
import { Badge } from '../Badge'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../Dialog'
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from '../Table'
import { IconPicker } from '../IconPicker'
import { AlfheimLogo } from '../AlfheimLogo'
import { AppLogo } from '../AppLogo'
import { LanguageProvider } from '../../../i18n/utils/LanguageContext'

describe('Button Component', () => {
  it('passes accessibility audit', async () => {
    const { container } = render(<Button>Click Me</Button>)
    expect(await axe(container)).toHaveNoViolations()
  })

  it('renders button with different variants and sizes', () => {
    render(
      <Button variant="destructive" size="sm">
        Delete
      </Button>
    )
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })
})

describe('Badge Component', () => {
  it('renders badge content with variant class', () => {
    render(<Badge variant="secondary">Active</Badge>)
    expect(screen.getByText('Active')).toBeInTheDocument()
  })
})

describe('Dialog Component', () => {
  it('opens and closes dialog content on trigger click', async () => {
    const user = userEvent.setup()
    render(
      <LanguageProvider defaultLanguage="en">
        <Dialog>
          <DialogTriggerAsButton />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Dialog Title</DialogTitle>
              <DialogDescription>Dialog Description</DialogDescription>
            </DialogHeader>
            <div>Modal Body</div>
            <DialogFooter>
              <button type="button">Action</button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </LanguageProvider>
    )

    await user.click(screen.getByText('Open Dialog'))
    expect(screen.getByText('Dialog Title')).toBeInTheDocument()
    expect(screen.getByText('Modal Body')).toBeInTheDocument()
  })
})

function DialogTriggerAsButton() {
  return <DialogTrigger>Open Dialog</DialogTrigger>
}

describe('Table Component', () => {
  it('renders full table structure', () => {
    render(
      <Table>
        <TableCaption>Summary Table</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Header 1</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Cell 1</TableCell>
          </TableRow>
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell>Footer 1</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    )
    expect(screen.getByText('Summary Table')).toBeInTheDocument()
    expect(screen.getByText('Header 1')).toBeInTheDocument()
    expect(screen.getByText('Cell 1')).toBeInTheDocument()
    expect(screen.getByText('Footer 1')).toBeInTheDocument()
  })
})

describe('IconPicker Component', () => {
  it('opens icon dropdown and filters available icons', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()

    render(
      <LanguageProvider defaultLanguage="en">
        <IconPicker selectedIconId="apple" onSelectIcon={onSelect} />
      </LanguageProvider>
    )

    await user.click(screen.getByRole('button', { name: /select icon/i }))
    expect(screen.getByPlaceholderText(/search/i)).toBeInTheDocument()

    await user.type(screen.getByPlaceholderText(/search/i), 'banana')
    expect(screen.getByTitle('Banana')).toBeInTheDocument()

    await user.click(screen.getByTitle('Banana'))
    expect(onSelect).toHaveBeenCalledWith('banana')
  })
})

describe('Logos Components', () => {
  it('renders AlfheimLogo and AppLogo SVG graphics', () => {
    const { container: container1 } = render(<AlfheimLogo className="w-8 h-8" />)
    const { container: container2 } = render(<AppLogo appName="pantry" className="w-8 h-8" />)
    expect(container1.querySelector('svg')).toBeInTheDocument()
    expect(container2.querySelector('svg')).toBeInTheDocument()
  })
})
