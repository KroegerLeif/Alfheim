import React from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi } from 'vitest'
import { axe } from 'vitest-axe'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../Card'
import { Input, Textarea, Field } from '../Input'
import { Select } from '../Select'
import { Checkbox } from '../Checkbox'
import { Spinner } from '../Spinner'
import { Skeleton } from '../Skeleton'
import { EmptyState } from '../EmptyState'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../Tabs'
import { BottomNav } from '../BottomNav'

describe('Card', () => {
  it('passes accessibility audit', async () => {
    const { container } = render(
      <Card>
        <CardHeader>
          <CardTitle>Plan</CardTitle>
          <CardDescription>Push Pull Legs</CardDescription>
        </CardHeader>
        <CardContent>Body</CardContent>
        <CardFooter>Footer</CardFooter>
      </Card>
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  it('renders all subcomponents and merges custom classes', () => {
    render(
      <Card className="custom-card">
        <CardHeader>
          <CardTitle>Plan</CardTitle>
        </CardHeader>
        <CardContent>Body</CardContent>
      </Card>
    )
    expect(screen.getByRole('heading', { name: 'Plan' })).toBeInTheDocument()
    expect(screen.getByText('Body')).toBeInTheDocument()
    expect(screen.getByText('Plan').closest('.custom-card')).not.toBeNull()
  })
})

describe('Input / Textarea / Field', () => {
  it('passes accessibility audit with an associated label', async () => {
    const { container } = render(
      <Field htmlFor="weight" label="Weight" required>
        <Input id="weight" />
      </Field>
    )
    expect(await axe(container)).toHaveNoViolations()
  })

  it('associates the label with the control', () => {
    render(
      <Field htmlFor="weight" label="Weight">
        <Input id="weight" />
      </Field>
    )
    expect(screen.getByLabelText('Weight')).toBeInTheDocument()
  })

  it('renders an error with role alert', () => {
    render(
      <Field htmlFor="weight" label="Weight" error="Required">
        <Input id="weight" />
      </Field>
    )
    expect(screen.getByRole('alert')).toHaveTextContent('Required')
  })

  it('accepts typed input', async () => {
    const user = userEvent.setup()
    render(<Input aria-label="reps" />)
    await user.type(screen.getByLabelText('reps'), '12')
    expect(screen.getByLabelText('reps')).toHaveValue('12')
  })

  it('renders a textarea', () => {
    render(<Textarea aria-label="notes" />)
    expect(screen.getByLabelText('notes').tagName).toBe('TEXTAREA')
  })
})

describe('Select', () => {
  const options = [
    { value: 'kg', label: 'Kilograms' },
    { value: 'lb', label: 'Pounds' },
  ]

  it('passes accessibility audit', async () => {
    const { container } = render(<Select aria-label="unit" options={options} />)
    expect(await axe(container)).toHaveNoViolations()
  })

  it('renders every option and a disabled placeholder', () => {
    render(<Select aria-label="unit" options={options} placeholder="Choose" defaultValue="" />)
    expect(screen.getByRole('option', { name: 'Choose' })).toBeDisabled()
    expect(screen.getByRole('option', { name: 'Kilograms' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'Pounds' })).toBeInTheDocument()
  })

  it('tolerates a null options payload', () => {
    render(<Select aria-label="unit" options={null as never} />)
    expect(screen.getByLabelText('unit')).toBeInTheDocument()
  })
})

describe('Checkbox', () => {
  it('passes accessibility audit with a label', async () => {
    const { container } = render(<Checkbox label="Shared" />)
    expect(await axe(container)).toHaveNoViolations()
  })

  it('toggles when its label is clicked', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Checkbox label="Shared" onChange={onChange} />)
    await user.click(screen.getByLabelText('Shared'))
    expect(onChange).toHaveBeenCalled()
  })

  it('renders a bare box when no label is given', () => {
    render(<Checkbox aria-label="bare" />)
    expect(screen.getByRole('checkbox')).toBeInTheDocument()
  })
})

describe('Spinner / Skeleton / EmptyState', () => {
  it('spinner exposes a status role and an accessible label', async () => {
    const { container } = render(<Spinner label="Loading plans" />)
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(screen.getByText('Loading plans')).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
  })

  it('skeleton is hidden from assistive technology', () => {
    const { container } = render(<Skeleton className="h-4 w-20" />)
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true')
  })

  it('empty state renders title, description and action', async () => {
    const { container } = render(
      <EmptyState title="No plans" description="Create your first plan" action={<button>Create</button>} />
    )
    expect(screen.getByText('No plans')).toBeInTheDocument()
    expect(screen.getByText('Create your first plan')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create' })).toBeInTheDocument()
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe('Tabs', () => {
  const renderTabs = () =>
    render(
      <Tabs defaultValue="exercises">
        <TabsList aria-label="Catalog sections">
          <TabsTrigger value="exercises">Exercises</TabsTrigger>
          <TabsTrigger value="equipment">Equipment</TabsTrigger>
        </TabsList>
        <TabsContent value="exercises">Exercise list</TabsContent>
        <TabsContent value="equipment">Equipment list</TabsContent>
      </Tabs>
    )

  it('passes accessibility audit', async () => {
    const { container } = renderTabs()
    expect(await axe(container)).toHaveNoViolations()
  })

  it('shows only the active panel and switches on click', async () => {
    const user = userEvent.setup()
    renderTabs()
    expect(screen.getByText('Exercise list')).toBeInTheDocument()
    expect(screen.queryByText('Equipment list')).not.toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: 'Equipment' }))
    expect(screen.getByText('Equipment list')).toBeInTheDocument()
    expect(screen.queryByText('Exercise list')).not.toBeInTheDocument()
  })
})

describe('BottomNav', () => {
  const items = [
    { href: '/today', label: 'Today', icon: <span>T</span> },
    { href: '/plans', label: 'Plans', icon: <span>P</span>, badgeCount: 2 },
  ]

  it('passes accessibility audit', async () => {
    const { container } = render(<BottomNav ariaLabel="Primary" items={items} activeHref="/today" />)
    expect(await axe(container)).toHaveNoViolations()
  })

  it('marks the active item with aria-current and renders the badge', () => {
    render(<BottomNav ariaLabel="Primary" items={items} activeHref="/today" />)
    expect(screen.getByRole('link', { name: /Today/ })).toHaveAttribute('aria-current', 'page')
    expect(screen.getByRole('link', { name: /Plans/ })).not.toHaveAttribute('aria-current')
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('delegates rendering to renderLink when provided', () => {
    render(
      <BottomNav
        ariaLabel="Primary"
        items={items}
        activeHref="/plans"
        renderLink={(item, props) => <button {...props} data-href={item.href} />}
      />
    )
    expect(screen.getByRole('button', { name: /Plans/ })).toHaveAttribute('data-href', '/plans')
  })

  it('tolerates a null items payload', () => {
    render(<BottomNav ariaLabel="Primary" items={null as never} />)
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument()
  })
})
