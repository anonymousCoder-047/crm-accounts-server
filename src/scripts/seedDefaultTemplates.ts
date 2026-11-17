import mongoose from 'mongoose'
import * as fs from 'fs'
import * as path from 'path'
import SalesInvoiceTemplate from '../models/SalesInvoiceTemplate'
import PurchaseInvoiceTemplate from '../models/PurchaseInvoiceTemplate'

// Load the default template JSON files
const salesTemplatePath = path.join(__dirname, '../../../frontend/src/templates/default-invoice-template.json')
const purchaseTemplatePath = path.join(__dirname, '../../../frontend/src/templates/default-purchase-invoice-template.json')
const salesTemplateData = JSON.parse(fs.readFileSync(salesTemplatePath, 'utf-8'))
const purchaseTemplateData = JSON.parse(fs.readFileSync(purchaseTemplatePath, 'utf-8'))

async function seedDefaultTemplates() {
    try {
        // Connect to MongoDB
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/crm-accounts'
        await mongoose.connect(mongoUri)
        console.log('✅ Connected to MongoDB')

        // Prepare sales template data
        const salesTemplateDesign = {
            pageWidth: salesTemplateData.pageWidth,
            pageHeight: salesTemplateData.pageHeight,
            elements: salesTemplateData.elements
        }

        // Seed Sales Invoice Template
        console.log('\n📄 Seeding Sales Invoice Template...')
        const existingSalesTemplate = await SalesInvoiceTemplate.findOne({ name: 'Default Bilingual Template' })

        if (existingSalesTemplate) {
            console.log('   ℹ️  Template already exists, updating...')
            existingSalesTemplate.description = salesTemplateData.description
            existingSalesTemplate.isDefault = true
            existingSalesTemplate.design = salesTemplateDesign
            existingSalesTemplate.layout = {
                header: {
                    showLogo: true,
                    logoPosition: 'right',
                    showCompanyName: true,
                    showCompanyAddress: false,
                    showCompanyContact: false
                },
                body: {
                    showInvoiceNumber: true,
                    showDate: true,
                    showCustomerDetails: true,
                    showDeliveryAddress: true,
                    showLineItems: true,
                    showDiscount: true,
                    showVat: true,
                    showTotal: true,
                    showPaymentMethod: false,
                    showStatus: false,
                    showTrn: true
                },
                footer: {
                    showTerms: false,
                    showNotes: true,
                    customFooter: 'Thank You For Your Business'
                }
            }
            existingSalesTemplate.styling = {
                primaryColor: '#E21C1C',
                secondaryColor: '#000000',
                fontFamily: 'Arial',
                fontSize: '12px',
                borderStyle: 'solid',
                logoSize: 'medium'
            }
            await existingSalesTemplate.save()
            console.log('   ✅ Sales Invoice Template updated successfully')
        } else {
            const salesTemplate = new SalesInvoiceTemplate({
                name: 'Default Bilingual Template',
                description: salesTemplateData.description,
                isDefault: true,
                design: salesTemplateDesign,
                layout: {
                    header: {
                        showLogo: true,
                        logoPosition: 'right',
                        showCompanyName: true,
                        showCompanyAddress: false,
                        showCompanyContact: false
                    },
                    body: {
                        showInvoiceNumber: true,
                        showDate: true,
                        showCustomerDetails: true,
                        showDeliveryAddress: true,
                        showLineItems: true,
                        showDiscount: true,
                        showVat: true,
                        showTotal: true,
                        showPaymentMethod: false,
                        showStatus: false,
                        showTrn: true
                    },
                    footer: {
                        showTerms: false,
                        showNotes: true,
                        customFooter: 'Thank You For Your Business'
                    }
                },
                styling: {
                    primaryColor: '#E21C1C',
                    secondaryColor: '#000000',
                    fontFamily: 'Arial',
                    fontSize: '12px',
                    borderStyle: 'solid',
                    logoSize: 'medium'
                },
                fieldsVisibility: new Map()
            })
            await salesTemplate.save()
            console.log('   ✅ Sales Invoice Template created successfully')
        }

        // Prepare purchase template data
        const purchaseTemplateDesign = {
            pageWidth: purchaseTemplateData.pageWidth,
            pageHeight: purchaseTemplateData.pageHeight,
            elements: purchaseTemplateData.elements
        }

        // Seed Purchase Invoice Template
        console.log('\n📄 Seeding Purchase Invoice Template...')
        const existingPurchaseTemplate = await PurchaseInvoiceTemplate.findOne({ name: 'Default Bilingual Template' })

        if (existingPurchaseTemplate) {
            console.log('   ℹ️  Template already exists, updating...')
            existingPurchaseTemplate.description = purchaseTemplateData.description
            existingPurchaseTemplate.isDefault = true
            existingPurchaseTemplate.design = purchaseTemplateDesign
            existingPurchaseTemplate.layout = {
                header: {
                    showLogo: true,
                    logoPosition: 'right',
                    showSupplierBlock: false,
                    showCompanyDetails: true
                },
                body: {
                    showPurchaseNumber: true,
                    showDate: true,
                    showSupplierDetails: true,
                    showLineItems: true,
                    showDiscount: true,
                    showVat: true,
                    showTotal: true,
                    showStatus: false
                },
                footer: {
                    showTerms: false,
                    showNotes: true,
                    customFooter: 'Thank You For Your Business'
                }
            }
            existingPurchaseTemplate.styling = {
                primaryColor: '#E21C1C',
                secondaryColor: '#000000',
                fontFamily: 'Arial',
                fontSize: '12px',
                borderStyle: 'solid',
                logoSize: 'medium'
            }
            await existingPurchaseTemplate.save()
            console.log('   ✅ Purchase Invoice Template updated successfully')
        } else {
            const purchaseTemplate = new PurchaseInvoiceTemplate({
                name: 'Default Bilingual Template',
                description: purchaseTemplateData.description,
                isDefault: true,
                design: purchaseTemplateDesign,
                layout: {
                    header: {
                        showLogo: true,
                        logoPosition: 'right',
                        showSupplierBlock: false,
                        showCompanyDetails: true
                    },
                    body: {
                        showPurchaseNumber: true,
                        showDate: true,
                        showSupplierDetails: true,
                        showLineItems: true,
                        showDiscount: true,
                        showVat: true,
                        showTotal: true,
                        showStatus: false
                    },
                    footer: {
                        showTerms: false,
                        showNotes: true,
                        customFooter: 'Thank You For Your Business'
                    }
                },
                styling: {
                    primaryColor: '#E21C1C',
                    secondaryColor: '#000000',
                    fontFamily: 'Arial',
                    fontSize: '12px',
                    borderStyle: 'solid',
                    logoSize: 'medium'
                },
                fieldsVisibility: new Map()
            })
            await purchaseTemplate.save()
            console.log('   ✅ Purchase Invoice Template created successfully')
        }

        console.log('\n✅ All templates seeded successfully!')
        console.log('\n📊 Summary:')
        console.log('   - Sales Invoice Template: ✅')
        console.log('   - Purchase Invoice Template: ✅')
        console.log('   - Sales template elements:', salesTemplateData.elements.length)
        console.log('   - Purchase template elements:', purchaseTemplateData.elements.length)

    } catch (error) {
        console.error('❌ Error seeding templates:', error)
        throw error
    } finally {
        await mongoose.disconnect()
        console.log('\n👋 Disconnected from MongoDB')
    }
}

// Run the seeder
if (require.main === module) {
    seedDefaultTemplates()
        .then(() => {
            console.log('\n🎉 Seeding completed!')
            process.exit(0)
        })
        .catch((error) => {
            console.error('\n💥 Seeding failed:', error)
            process.exit(1)
        })
}

export default seedDefaultTemplates
