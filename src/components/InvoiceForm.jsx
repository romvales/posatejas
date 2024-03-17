
import { SelectorIcon, XIcon, CashIcon, PencilAltIcon, BookmarkIcon, PlusCircleIcon } from '@heroicons/react/outline'
import { CashPaymentForm } from '../components/CashPaymentForm'
import { useLoaderData } from 'react-router-dom'
import { createRef, useEffect, useMemo, useState } from 'react'
import { getFullName, pesoFormatter, saveSalesToDatabase } from '../actions'

import { OrderSummaryItem } from '../components/OrderSummaryItem'
import { NewContactPopup } from '../components/NewContactPopup'
import { ContactSelector } from './ContactSelector'
import { SalesRegisterPageDataLoader } from '../pages/loaders'

export { InvoiceForm }

// Used for generating a new invoice number
const generateInvoiceNo = () => {
  const a = new Uint32Array(2)
  return crypto.getRandomValues(a).reduce((a, b) => a + b).toString() + a.at(0).toString().slice(0, 5)
}

// Used for resetting the sales form state to default 
export const defaultSale = {
  customer_id: '',
  sales_date: new Date(),
  sales_status: 'in-progress',
  is_cancelled: false,
  discount_amount: 0,
  tax_amount: 0,
  sub_total: 0,
  total_due: 0,
  amount_paid: 0,
  change_due: 0,
  invoice_no: generateInvoiceNo(),
  payment_method: '',

  //
  selections: {},
  length: 0,
}

// Adds a product to the order summary items (used in OrderSummaryItem.jsx)
export const addProductToSelection = (product, salesState) => {
  const [sales, setSales] = salesState

  const clone = structuredClone(sales)

  // @NOTE: Instead of using the unit cost of a product, we'll revert to the price level 1.
  const itemPriceLevels = [...product.itemPriceLevels].sort((a, b) => a.priceLevel.level_name > b.priceLevel.level_name)

  clone.selections[product.id] = {
    item_index: clone.length,
    product: structuredClone(product),
    item_id: product.id,
    price_level_id: null,
    quantity: 1,

    cost: /** product.item_cost */ itemPriceLevels[0].priceLevel.price,
    price: /** product.item_cost */ itemPriceLevels[0].priceLevel.price,
  }


  clone.length++
  setSales(clone)
}

export const deselectProductFromSelection = (id, salesState) => {
  const [sales, setSales] = salesState

  const clone = structuredClone(sales)

  delete clone.selections[id]
  clone.length--
  setSales(clone)
}

function InvoiceForm(props) {
  const { staticInvoiceTypes, staticCustomers, staticLocations } = useLoaderData()

  const [contacts, setContacts] = useState(staticCustomers)
  const [recalculate, setRecalculate] = useState(false)
  const [selectedCustomer, setSelectedCustomer] = props.selectedCustomerState ?? useState()
  const [sales, setSales] = props.salesState
  const persistPriceLevel = props.persistPriceLevel
  const actionType = props.actionType ?? ''

  const formRef = createRef()

  // Save the sales, order summary items (selections) to the database as PAID.
  const onSubmit = (ev) => {
    ev.preventDefault()

    sales.customer_id = selectedCustomer.id
    sales.sales_status = 'paid'

    saveSalesToDatabase(sales)
      .then(() => {
        if (props.onSubmitSuccess) props.onSubmitSuccess()
        if (props.discardOnSuccess) onDiscard()
      })
      .catch()
  }

  // @FEATURE: Save the sales, order summary items (selections) to the database as PENDING.
  const onSave = () => {
    sales.customer_id = selectedCustomer.id
    saveSalesToDatabase(sales)
      .then(() => {
        if (props.onSaveSuccess) props.onSaveSuccess()
      })
      .catch()
  }

  // Used for clearing the form after 
  const onDiscard = () => {
    const clonedDefaultSale = structuredClone(defaultSale)

    // @FEATURE: Regenerates a new invoice number for the next order
    clonedDefaultSale.invoice_no = generateInvoiceNo()

    setSales(clonedDefaultSale)
    setSelectedCustomer()
    formRef.current.reset()
  }

  // Sales recalculator whenever changes are detected
  const recalculateSales = () => {
    const clone = structuredClone(sales)

    clone.customer_id = selectedCustomer?.id
    clone.sub_total = 0
    clone.discount_amount = 0
    clone.tax_amount = 0
    clone.total_due = 0

    for (const selection of Object.values(sales.selections)) {
      clone.sub_total += selection.price
    }

    clone.total_due = clone.sub_total + clone.tax_amount - clone.discount_amount
    setSales(clone)
  }

  // Sorts the items in the summary
  const sortFn = (a, b) => a.item_index < b.item_index

  // @FEATURE: Check all required properties if populated before enabling the form
  const isValid = useMemo(() => {
    let valid = false

    if (sales.payment_method.length && selectedCustomer != null &&
      Object.keys(sales.selections).length && sales.amount_paid >= sales.total_due) valid = true

    return valid
  }, [sales])

  // @FEATURE: Update/recalculate the sales information whenever the selected customer or order summary items change
  useEffect(() => {
    recalculateSales()
  }, [recalculate, selectedCustomer])

  useEffect(() => {
    setSelectedCustomer(structuredClone(sales.customer))
  }, [])

  return (
    <>
      <form ref={formRef} className='row' onSubmit={onSubmit}>
        {
          selectedCustomer ?
            <section className='d-flex gap-3 py-3 rounded border shadow-sm mb-2 bg-white'>
              <picture>
                <img src={`https://placehold.co/64?text=${selectedCustomer.first_name}`} className='rounded-circle' alt={'Customer\'s profile picture'} />
              </picture>
              <div className='flex-grow-1'>
                <ul className='list-unstyled mb-0'>
                  <li>
                    <h4 className='fs-5 fw-bold mb-0'>{getFullName(selectedCustomer)}</h4>
                  </li>
                  <li className='d-flex gap-1'>
                    <span style={{ fontSize: '0.8rem' }} className='text-secondary'>{selectedCustomer.id}</span>
                    <span style={{ fontSize: '0.8rem' }} className='text-secondary'>
                      (Price Level: {selectedCustomer.price_level})
                    </span>
                  </li>
                </ul>
              </div>
              <div className='d-grid flex-column gap-1 align-items-center'>
                <button
                  type='button'
                  className='btn btn-outline-secondary btn-sm d-flex align-items-center justify-content-center'
                  data-bs-toggle='modal'
                  data-bs-target='#contactSelection'>
                  <SelectorIcon width={18} />
                  <span className='initialism text-capitalize'>Choose</span>
                </button>
                <button
                  type='button'
                  className='btn btn-outline-secondary btn-sm d-flex align-items-center justify-content-center'
                  data-bs-toggle='modal'
                  data-bs-target='#addContact'>
                  <PencilAltIcon width={18} />
                  <span className='initialism text-capitalize'>Edit</span>
                </button>
              </div>
            </section>
            :
            <section className='d-flex gap-3 py-3 rounded border shadow-sm mb-2 bg-white'>
              <picture>
                <img src={'https://placehold.co/64?text=Customer'} className='rounded-circle' alt={'Customer\'s profile picture'} />
              </picture>
              <div className='flex-grow-1'>
                <ul className='list-unstyled mb-0'>
                  <li>
                    <h4 className='fs-6 fw-bold mb-0'>No Customer</h4>
                  </li>
                  <li>
                    <span style={{ fontSize: '0.8rem' }} className='text-secondary'></span>
                  </li>
                </ul>
              </div>
              <div className='d-grid flex-column gap-1 align-items-center'>
                <button
                  type='button'
                  className='btn btn-outline-secondary btn-sm d-flex align-items-center justify-content-center'
                  data-bs-toggle='modal'
                  data-bs-target='#contactSelection'>
                  <SelectorIcon width={18} />
                  <span className='initialism text-capitalize'>Choose</span>
                </button>
                <button
                  type='button'
                  className='btn btn-outline-secondary btn-sm d-flex align-items-center justify-content-center'
                  data-bs-toggle='modal'
                  data-bs-target='#addContact'>
                  <PlusCircleIcon width={18} />
                  <span className='initialism text-capitalize'>Add</span>
                </button>
              </div>
            </section>
        }

        <ul className='d-none list-unstyled d-flex gap-2 px-0 mb-2'>
          {
            staticInvoiceTypes.map(invoiceType => {
              const checkboxRef = createRef()

              const onChange = () => {
                const cloneSales = structuredClone(sales)
                cloneSales.invoice_type_id = invoiceType.id
                setSales(cloneSales)
              }

              return (
                <li key={invoiceType.code} className='col'>
                  <div className='btn-group w-100' role='group' aria-label='Invoice type selector'>
                    <input
                      ref={checkboxRef}
                      checked={sales.invoice_type_id == invoiceType.id}
                      type='checkbox'
                      className='btn-check'
                      id={`invoiceType${invoiceType.code}`} autoComplete='off' onChange={onChange} />
                    <label title={invoiceType.invoice_name} className='btn btn-outline-primary px-2' htmlFor={`invoiceType${invoiceType.code}`}>
                      <span className='initialism text-capitalize fw-semibold'>{invoiceType.code}</span>
                    </label>
                  </div>
                </li>
              )
            })
          }
        </ul>

        <div className='shadow-sm rounded py-3 mb-3 border bg-white'>
          <div className='mb-4'>
            <div className='d-flex mb-1 justify-content-between'>
              <div>
                <h3 className='fs-5 m-0 fw-bold mb-1 text-capitalize'>Order Summary</h3>
                <p style={{ fontSize: '0.8rem' }} className='text-secondary'>Invoice#{sales.invoice_no}</p>
              </div>
              <nav className=''>
                <ul className='d-flex gap-2 list-unstyled p-0'>
                  {
                    isValid ?
                      <li className=''>
                        <button
                          type='button'
                          style={{ border: 0 }}
                          className='btn d-flex p-0 text-secondary flex-column align-items-center'
                          onClick={onSave}>
                          <BookmarkIcon width={18} />
                          <span style={{ fontSize: '0.6rem' }}>Save</span>
                        </button>
                      </li>
                      :
                      <></>
                  }
                  {
                    actionType == '' ?
                      <li className=''>
                        <button type='button' style={{ border: 0 }} className='btn d-flex p-0 text-danger opacity-75 flex-column align-items-center' onClick={onDiscard}>
                          <XIcon width={18} />
                          <span style={{ fontSize: '0.6rem' }}>Discard</span>
                        </button>
                      </li>
                      :
                      <></>
                  }
                </ul>
              </nav>
            </div>

            <ul className='d-flex flex-column gap-1 list-unstyled mb-0'>
              {
                Object.values(sales.selections).sort(sortFn).map((selection, i) => {
                  return (
                    <OrderSummaryItem
                      key={i}
                      persistPriceLevel={persistPriceLevel}
                      salesState={[sales, setSales]}
                      productData={selection.product}
                      recalculator={[recalculate, setRecalculate]}
                      selectedCustomer={selectedCustomer} />
                  )
                })
              }
            </ul>
          </div>

          <div>
            <dl className='grid'>
              <div className='d-flex justify-content-between'>
                <dt className='text-secondary fw-semibold'>
                  Subtotal
                </dt>
                <dd>
                  {pesoFormatter.format(sales.sub_total)}
                </dd>
              </div>

              <div className='d-flex justify-content-between'>
                <dt className='text-secondary fw-semibold'>
                  Tax
                </dt>
                <dd>
                  {pesoFormatter.format(sales.tax_amount)}
                </dd>
              </div>

              <div className='d-flex justify-content-between'>
                <dt className='text-secondary fw-semibold'>
                  Discount
                </dt>
                <dd>
                  {pesoFormatter.format(sales.discount_amount)}
                </dd>
              </div>

              <hr className='border-secondary' />

              <div className='d-flex justify-content-between'>
                <dt>
                  Total
                </dt>
                <dd className='fs-5'>
                  {pesoFormatter.format(sales.total_due)}
                </dd>
              </div>
            </dl>
          </div>

          <fieldset className=''>
            <label htmlFor='' className='fs-6 fw-semibold mb-3 text-secondary'>Payment Method</label>
            <div className='row'>
              <div className='col'>
                <div className=''>
                  {
                    (() => {
                      const checkboxRef = createRef()

                      const onChange = () => {

                        if (checkboxRef.current.checked) {
                          sales.payment_method = 'cash'
                        } else {
                          sales.payment_method = ''
                        }

                        setSales(structuredClone(sales))
                      }

                      return (
                        <div className='btn-group' role='group' aria-label='Cash payment method'>
                          <input
                            ref={checkboxRef}
                            checked={sales.payment_method != ''}
                            type='checkbox'
                            className='btn-check'
                            id='cashPaymentMethod' autoComplete='off' onChange={onChange} />
                          <label className='btn btn-outline-primary px-2' htmlFor='cashPaymentMethod'>
                            <CashIcon width={20} /><br />
                            <span className='initialism text-capitalize fw-semibold'>Cash</span>
                          </label>
                        </div>
                      )
                    })()
                  }
                </div>
              </div>
            </div>
          </fieldset>
        </div>

        {sales.payment_method == 'cash' ? <CashPaymentForm isValid={isValid} sales={sales} setSales={setSales} /> : <> </>}

        {
          actionType == '' ?
            <div className='d-grid p-0'>
              <button
                type='submit'
                className='btn btn-primary btn-pill p-3 d-flex justify-content-center align-items-center gap-1'
                disabled={!isValid}>
                <span className='fs-5'>Finish Transaction</span>
              </button>
            </div>
            :
            <></>
        }
      </form>

      <NewContactPopup
        isReadOnlyCustomerType={true}
        locations={staticLocations}
        contacts={contacts}
        updateContacts={setContacts}
        existingContact={selectedCustomer}
        updateExistingContact={setSelectedCustomer}></NewContactPopup>

      <ContactSelector
        contacts={contacts}
        updateSelection={setSelectedCustomer}></ContactSelector>
    </>
  )
}