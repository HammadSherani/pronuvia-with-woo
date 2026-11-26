// The Terms and Conditions shown on /terms (linked from sign-up and checkout).
// Copied word for word from https://login2.pronuvia.com/terms/ on 2026-11-26.
// Inline HTML is limited to <strong>, <a> and <br />: fixed text, not user input.
export type TermsBlock = { tag: "h2" | "h3" | "h4" | "p" | "li"; html: string };

export const TERMS_SOURCE = "https://login2.pronuvia.com/terms/";

export const TERMS: TermsBlock[] = [
  {
    "tag": "h2",
    "html": "Terms and Conditions for Doctor’s Registration"
  },
  {
    "tag": "p",
    "html": "Welcome to the Pronuvia, Inc. practitioner ordering website (www.pronuvia.com), which is provided for licensed doctors and health professionals who purchase our products for use with their patients."
  },
  {
    "tag": "p",
    "html": "Please read these Terms and Conditions (“Terms”) carefully before using the www.pronuvia.com website and ordering system (the “Service”). By registering for an account, logging in to your account, placing an order, or accepting a commission payment, you agree to be bound by these Terms. If you disagree with any part of these Terms, do not use the Service, and let us know so that we can close your account."
  },
  {
    "tag": "p",
    "html": "Products are provided by Pronuvia, Inc., located at 36-09 165th Street, Flushing, NY 11358 (“COMPANY”), to you, the registered doctor or healthcare professional (“YOU”). These Terms, together with the Terms and Conditions for Using This Website below, and any additional terms provided to YOU separately, form the agreement between COMPANY and YOU (the “Agreement”)."
  },
  {
    "tag": "h3",
    "html": "Doctor Relationship"
  },
  {
    "tag": "p",
    "html": "<strong>Appointment of Participating Doctor.</strong> COMPANY appoints YOU during the term of this Agreement as COMPANY’s non-exclusive authorized participating practitioner to recommend and provide the products supplied by COMPANY (“PRODUCTS”) to YOUR patients under YOUR professional responsibility."
  },
  {
    "tag": "p",
    "html": "<strong>Relationship of Parties.</strong> YOU shall conduct YOUR business in the purchase and resale of the PRODUCTS as a principal for YOUR own account, at YOUR own expense and risk. This Agreement does not create a principal-agent, employment, partnership, joint venture, or similar relationship between COMPANY and YOU. YOU agree not to act or represent YOURSELF directly or by implication as COMPANY’s agent and not to attempt to create any obligation, or make any representation, on COMPANY’s behalf or in its name."
  },
  {
    "tag": "p",
    "html": "<strong>The Scope of Practice.</strong> YOU shall use and recommend PRODUCTS only within the legally allowed scope of YOUR license and in accordance with applicable laws and professional rules. PRODUCTS are dietary supplements, and any decision to recommend them to a patient is YOUR independent professional judgment."
  },
  {
    "tag": "p",
    "html": "For example, a nutritionist may recommend PRODUCTS as a calcium supplement to support healthy calcium levels and calcium homeostasis as part of a nutritional program."
  },
  {
    "tag": "p",
    "html": "<strong>Eligibility and License.</strong> YOU represent that YOU hold a current, valid professional license and that the information YOU provide to COMPANY (including YOUR name, practice name, license type and number, and contact details) is true and complete. YOU shall promptly notify COMPANY if YOUR license is suspended, revoked, restricted, or expires. COMPANY may verify YOUR license and may decline or close any account at its discretion."
  },
  {
    "tag": "p",
    "html": "<strong>Account Setup.</strong> COMPANY may set up YOUR account using the information YOU provided when YOU expressed interest in PRODUCTS, and will send YOUR login information by email. YOU are responsible for keeping YOUR login credentials confidential and for all orders placed under YOUR account. YOU may ask COMPANY to close YOUR account at any time by contacting us at the email address below."
  },
  {
    "tag": "p",
    "html": "<strong>Use of YOUR Information.</strong> COMPANY uses YOUR information to manage YOUR account, verify YOUR license, process and ship orders, pay commissions, and send YOU product, ordering, and educational information. COMPANY does not sell YOUR information. YOU may opt out of marketing emails at any time by using the unsubscribe link or contacting us; COMPANY may still send YOU messages about YOUR account and orders."
  },
  {
    "tag": "p",
    "html": "<strong>Patient Information.</strong> When YOU ask COMPANY to ship PRODUCTS directly to a patient, YOU represent that the patient has agreed to YOU sharing the patient’s name, shipping address, and contact details with COMPANY for that purpose. Please do not send COMPANY any diagnosis, treatment, or other medical information about patients."
  },
  {
    "tag": "h3",
    "html": "Purchase, Payment, and Commission"
  },
  {
    "tag": "p",
    "html": "<strong>Sale and Purchase.</strong> COMPANY agrees to sell PRODUCTS to YOU, and YOU agree to purchase PRODUCTS from COMPANY, under this Agreement."
  },
  {
    "tag": "p",
    "html": "<strong>Recommendation to Patients.</strong> YOU may recommend PRODUCTS to patients for whom YOU determine they are appropriate. COMPANY will provide the suggested retail price and other PRODUCT information through the website. YOU shall not repackage, relabel, or alter PRODUCTS, and shall not sell PRODUCTS through online marketplaces (such as Amazon or eBay) without COMPANY’s prior written approval."
  },
  {
    "tag": "p",
    "html": "<strong>Purchase Orders.</strong> The sale by COMPANY to YOU of PRODUCTS shall be subject to the provisions of this Agreement. Any inconsistent provision of any purchase order placed by YOU shall be null and void unless expressly accepted by COMPANY in writing."
  },
  {
    "tag": "p",
    "html": "YOU shall order PRODUCTS through COMPANY’s website under YOUR account login. Each order YOU submit is a binding commitment to purchase. COMPANY will send YOU an order confirmation by email, and an order is accepted when COMPANY confirms or ships it. COMPANY may decline or cancel any order, in which case any payment for that order will be refunded."
  },
  {
    "tag": "p",
    "html": "COMPANY shall use commercially reasonable efforts to ship PRODUCTS promptly but shall not be liable to YOU for shipping delays. If COMPANY determines that an order will be significantly delayed, COMPANY will notify YOU by email."
  },
  {
    "tag": "p",
    "html": "<strong>Pricing.</strong> The prices of PRODUCTS sold to YOU shall be the Retail Price determined by COMPANY and listed on the website at the time YOUR order is accepted. COMPANY may change prices for future orders at any time. YOU shall pay all license fees, sales, use, service use, occupation, personal property, and excise taxes and any other fees, assessments or taxes which may be assessed or levied by any national, state or local government and any departments and subdivisions thereof, against any of the PRODUCTS ordered by YOU and under YOUR direct or indirect control."
  },
  {
    "tag": "p",
    "html": "<strong>Payment and Delivery.</strong> Payment is due in full when YOU place an order (prepayment). Title and risk of loss pass to YOU when COMPANY delivers PRODUCTS to the carrier at COMPANY’s office or warehouse. Shipping charges, if any, are shown at checkout. In no event shall COMPANY be liable for consequential or special damages due to any cause. When YOU request that PRODUCTS be shipped directly to a patient, COMPANY will drop-ship them on the same payment and delivery terms."
  },
  {
    "tag": "p",
    "html": "<strong>Inspection.</strong> YOU (or the patient, for drop-shipped orders) shall inspect all PRODUCTS promptly upon receipt thereof for conformance with PRODUCTS’ specifications, to the extent determinable by reasonable inspection upon delivery. Any PRODUCTS not rejected within thirty (30) days of receipt shall be deemed accepted. COMPANY shall, at YOUR election and at COMPANY’s expense, either replace or refund non-conforming PRODUCTS within thirty (30) days of COMPANY’s receipt thereof."
  },
  {
    "tag": "p",
    "html": "<strong>Commission.</strong> For each eligible order under this Agreement, YOU shall be entitled to a commission at the commission rate COMPANY communicates to YOU, which COMPANY may change for future orders upon notice. Commissions are calculated on the product price only and do not include shipping, taxes, supplies, or other charges. If an order is returned or refunded, the related commission will be deducted from future commissions or, if there are none, repaid by YOU to COMPANY. Commissions for the prior month are paid in the first week of each month. Any wire transfer or similar payout fees will be deducted from the payout. YOU are responsible for complying with all laws and professional rules that apply to YOUR receipt of commissions, including any requirement to disclose YOUR financial interest to patients."
  },
  {
    "tag": "p",
    "html": "<strong>W-9 Form.</strong> For tax purposes, COMPANY will ask YOU to complete and sign IRS Form W-9 with YOUR Social Security Number or Taxpayer Identification Number (TIN). The form must be completed by YOU, the licensed account holder, as YOU are responsible for the practice under YOUR license and for taxes on commissions. Commissions will not be paid until COMPANY receives YOUR signed Form W-9, and COMPANY will issue IRS Form 1099 where required."
  },
  {
    "tag": "p",
    "html": "<strong>Additional Terms.</strong> Additional terms may apply to YOUR account as provided to YOU separately."
  },
  {
    "tag": "h3",
    "html": "Return Policy"
  },
  {
    "tag": "p",
    "html": "<strong>Shipping Risk.</strong> Because PRODUCTS are shipped Ex Works (EXW) and title and risk of loss pass to YOU when COMPANY delivers PRODUCTS to the carrier, COMPANY is not responsible for any damage to or loss of PRODUCTS during shipment once they leave COMPANY’s facility. Any claim for loss or damage in transit must be made with the carrier, and COMPANY will provide the tracking and shipping information needed to support that claim."
  },
  {
    "tag": "p",
    "html": "<strong>Returns.</strong> COMPANY will accept the return of PRODUCTS whose seal has not been removed (unopened PRODUCTS) within thirty (30) days of the shipping date. PRODUCTS that have been opened, or whose seal has been removed or broken, cannot be returned."
  },
  {
    "tag": "p",
    "html": "<strong>How to Return.</strong> The return shipping fee is paid by the person returning the PRODUCTS (the patient, or YOU for orders shipped to YOU). The return must include the packing list, or the person returning the PRODUCTS must email <a href=\"mailto:info@pronuvia.com\">info@pronuvia.com</a> with the order number. PRODUCTS are fragile, so the package must contain enough packing peanuts or other filling material to prevent breakage during delivery. COMPANY cannot refund PRODUCTS that are lost, or that arrive broken or with the seal removed, on the way back to COMPANY."
  },
  {
    "tag": "p",
    "html": "Please send returns to:"
  },
  {
    "tag": "p",
    "html": "Pronuvia, Inc.<br />Attn. Jason Park<br />36-09 165th St.<br />Flushing, NY 11358<br />Tel: 800-568-2982"
  },
  {
    "tag": "p",
    "html": "<strong>Refunds.</strong> Once COMPANY receives the returned PRODUCTS, COMPANY will refund the product amount to the original payment method. The original (outbound) shipping fee is not refunded, as that shipping service has already been used. Any commission paid on returned PRODUCTS will be deducted as described in the Commission section above."
  },
  {
    "tag": "p",
    "html": "<strong>Wrong Product Shipped.</strong> If COMPANY ships a wrong product, COMPANY will provide a prepaid return shipping label at COMPANY’s expense and will replace or refund the PRODUCTS as described in the Inspection section above."
  },
  {
    "tag": "h3",
    "html": "Indemnification and Liability"
  },
  {
    "tag": "p",
    "html": "<strong>Indemnification.</strong> YOU shall, at YOUR expense, indemnify, defend and hold COMPANY harmless against all costs and liabilities incurred in connection with any third-party claim, action, suit, or proceeding arising out of any negligent or reckless act or omission or willful misconduct by YOU or any of YOUR employees or agents, any improper use, storage, recommendation, or alteration of PRODUCTS by YOU, or YOUR breach of this Agreement."
  },
  {
    "tag": "p",
    "html": "<strong>Product Claim.</strong> YOU shall not claim that PRODUCTS diagnose, treat, cure, mitigate, or prevent any disease. YOU shall make only claims that are truthful, substantiated, and lawful for dietary supplements, and shall use only COMPANY-approved labels and materials when describing PRODUCTS. If YOU promote PRODUCTS publicly (for example, on a website or social media), YOU shall clearly disclose YOUR financial relationship with COMPANY."
  },
  {
    "tag": "p",
    "html": "<strong>Limitation of Liability.</strong> EXCEPT AS EXPRESSLY STATED IN THIS AGREEMENT, COMPANY MAKES NO OTHER WARRANTIES REGARDING PRODUCTS, EXPRESS OR IMPLIED, INCLUDING ANY IMPLIED WARRANTY OF MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE. COMPANY’S TOTAL LIABILITY ARISING OUT OF THIS AGREEMENT SHALL NOT EXCEED THE AMOUNT YOU PAID FOR THE PRODUCTS GIVING RISE TO THE CLAIM."
  },
  {
    "tag": "h3",
    "html": "Property Rights and Confidentiality"
  },
  {
    "tag": "p",
    "html": "<strong>Property Rights.</strong> YOU acknowledge that COMPANY owns all right, title, and interest in and to, or has all necessary rights to, PRODUCTS which are now or may hereafter be subject to this Agreement and all patents, trademarks, trade names, copyrights, and trade secrets originally made by COMPANY."
  },
  {
    "tag": "p",
    "html": "<strong>Confidentiality.</strong> YOU agree that YOU will not use in any way for YOUR own account or the account of any third party, nor disclose to any third party, any confidential information revealed to YOU by COMPANY. In the event of termination of this Agreement, there shall be no use or disclosure by YOU of any confidential information of COMPANY, and YOU shall not manufacture or have manufactured any products utilizing any of COMPANY’s confidential information."
  },
  {
    "tag": "h3",
    "html": "Termination"
  },
  {
    "tag": "p",
    "html": "<strong>For Failure to Perform.</strong> If YOU do not order PRODUCTS to the satisfaction of COMPANY, do not exert YOUR best efforts in COMPANY’s sole opinion, or do not conduct YOUR business in accordance with any requirements set forth herein to be performed by YOU, COMPANY may terminate this Agreement by giving YOU not less than thirty (30) days’ prior notice of termination."
  },
  {
    "tag": "p",
    "html": "<strong>Additional Reasons for Termination.</strong> COMPANY may terminate this Agreement immediately by delivering to YOU or YOUR representative written notice of such termination in the event of the happening of any of the following: (i) Any attempted transfer or assignment of this Agreement or any right or obligation hereunder or any sale, transfer, relinquishment, voluntary or involuntary, by operation of law or otherwise, of any interest in the direct or indirect ownership, control or active management of YOU without prior written approval of COMPANY; (ii) Any dispute, disagreement, or controversy between or among principals, partners, managers, officers or stockholders of YOU which, in the opinion of COMPANY, may adversely affect the ownership, operation, management, business or interest of YOU or COMPANY; (iii) The execution by YOU of an assignment for the benefit of creditors; the conviction of YOU or any principal officer or manager of YOU of any crimes which in the opinion of COMPANY may adversely affect the ownership, operation, management, business or interest of YOU or COMPANY; (iv) Failure of YOU to pay when due any indebtedness owing by YOU to COMPANY, unless expressly waived in writing by COMPANY; (v) The change of COMPANY policy; (vi) The suspension, revocation, restriction, or expiration of YOUR professional license; or (vii) Any breach by YOU of the Product Claim section."
  },
  {
    "tag": "p",
    "html": "<strong>Termination by YOU; Effect of Termination.</strong> YOU may terminate this Agreement at any time by written notice to COMPANY. Upon termination, YOUR account will be closed, and COMPANY will pay any earned commissions on orders that were paid and not returned before termination, less any amounts YOU owe COMPANY. The Indemnification and Liability, Property Rights and Confidentiality, and Governing Law provisions survive termination."
  },
  {
    "tag": "h3",
    "html": "Email and Text Message Communications"
  },
  {
    "tag": "p",
    "html": "Account, order and delivery emails are part of the service. Pronuvia sends text messages, and marketing emails, only to customers and practitioners who have opted in. Messages cover account application status, order confirmations and delivery updates, reordering reminders, scheduling and conversations with our team, and product information and offers."
  },
  {
    "tag": "p",
    "html": "Our forms have two separate consent boxes, one for account and order messages and one for marketing messages. Each box covers both email and text messages. By checking a box, you agree to receive that type of message only. Consent is not a condition of any purchase, and providing a mobile number, or an email address for marketing, is optional."
  },
  {
    "tag": "h4",
    "html": "Text messages"
  },
  {
    "tag": "li",
    "html": "Message frequency varies. Message and data rates may apply."
  },
  {
    "tag": "li",
    "html": "Reply STOP at any time to opt out of text messages."
  },
  {
    "tag": "li",
    "html": "Reply HELP for assistance."
  },
  {
    "tag": "li",
    "html": "For help, call 800-568-2982, Monday to Friday, 9:00 a.m. to 5:00 p.m. Eastern time, or email <a href=\"mailto:info@pronuvia.com\">info@pronuvia.com</a>."
  },
  {
    "tag": "li",
    "html": "Carriers are not liable for delayed or undelivered messages."
  },
  {
    "tag": "p",
    "html": "No mobile information will be shared with third parties or affiliates for marketing or promotional purposes. Information sharing to subcontractors in support services, such as customer service, is permitted. All other use case categories exclude text messaging originator opt-in data and consent; this information will not be shared with any third parties."
  },
  {
    "tag": "h4",
    "html": "Email"
  },
  {
    "tag": "p",
    "html": "Every marketing email identifies Pronuvia as the sender, includes our postal address, and carries an unsubscribe link. You can unsubscribe at any time. Account, order and delivery emails are part of the service and continue after you unsubscribe from marketing email."
  },
  {
    "tag": "p",
    "html": "For more on how Pronuvia collects and uses your information, see our Privacy Policy at <a href=\"https://login2.pronuvia.com/privacy-policy/\" target=\"_blank\" rel=\"noopener noreferrer\">https://login2.pronuvia.com/privacy-policy/</a>."
  },
  {
    "tag": "h3",
    "html": "Changes"
  },
  {
    "tag": "p",
    "html": "We may modify these Terms from time to time. If the changes are significant, we will notify YOU by email or through the website. YOUR continued use of the Service after the changes take effect means YOU accept the updated Terms."
  },
  {
    "tag": "h3",
    "html": "Contact Us"
  },
  {
    "tag": "p",
    "html": "If you have any questions about these Terms, please contact us at <a href=\"mailto:info@pronuvia.com\">info@pronuvia.com</a>."
  },
  {
    "tag": "h2",
    "html": "Terms and Conditions for Using This Website"
  },
  {
    "tag": "p",
    "html": "These terms and conditions of use describe the terms and conditions applicable to your use of Pronuvia Inc.’s (“Pronuvia”) website. By using this website, you signify your assent to these Terms and Conditions of Use. If you do not agree to all of these Terms and Conditions of Use, do not use this website."
  },
  {
    "tag": "p",
    "html": "Pronuvia may modify this website and the rules and regulations governing its use, at any time. Modifications will be posted on the website, so please check back when you use the website. By continuing use of the website after such changes are posted you will be accepting such changes."
  },
  {
    "tag": "h3",
    "html": "THIS WEBSITE DOES NOT PROVIDE MEDICAL OR PROFESSIONAL SERVICES ADVICE"
  },
  {
    "tag": "p",
    "html": "The content on this website is intended to be a general information resource in regard to the subject matter covered, but is provided solely on an “as is” and “as available” basis as noted on these Terms and Conditions of Use. You are encouraged to confirm the information contained herein with other sources, and to review the information carefully with your professional healthcare provider. Pronuvia is not engaged in rendering medical or similar professional services or advice via this website, and the information provided is not intended to replace medical advice offered by a physician. If you desire or need such services or advice, you should consult a professional healthcare provider. You should not construe Pronuvia’s publication of this content as an endorsement by Pronuvia of the views expressed herein, or any warranty or guarantee of any strategy, recommendation, treatment, action or application of medication or preparation made by the author of the content."
  },
  {
    "tag": "h3",
    "html": "SCOPE OF USE"
  },
  {
    "tag": "p",
    "html": "Pronuvia invites you to view, use and download a single copy of this website for your informational use and for ordering PRODUCTS under your account. Except as otherwise provided on this page, no part of any content or software on this website may be copied, downloaded or stored in a retrieval system for any other purpose, nor may it be redistributed for any purpose, without the expressed written permission of Pronuvia. You understand that Pronuvia may discontinue, change or restrict your use of this website for any reason without notice."
  },
  {
    "tag": "p",
    "html": "By using this website, you represent that you are at least 18 years old, and a licensed healthcare professional."
  },
  {
    "tag": "h3",
    "html": "NO WARRANTIES"
  },
  {
    "tag": "p",
    "html": "All content on this website is provided to you on an “as is” “as available” basis without warranty of any kind either express or implied, including but not limited to any implied warranties of merchantability, fitness for a particular purpose, accuracy and non-infringement. Pronuvia makes no warranty as to the accuracy, completeness, currency or reliability of any content available through this website. You are responsible for verifying any information before relying on it. Use of the website and the content available on the website is at your sole risk. Pronuvia makes no representations or warranties that use of the website will be uninterrupted or error-free. You are responsible for taking all necessary precautions to ensure that any content you may obtain from the website is free of viruses."
  },
  {
    "tag": "p",
    "html": "The above exclusions may not apply in jurisdictions that do not allow the exclusion of certain implied warranties."
  },
  {
    "tag": "h3",
    "html": "LIMITATION OF LIABILITY; NO DUTY TO UPDATE"
  },
  {
    "tag": "p",
    "html": "Your use of the website or any content on the website is at your own risk. Pronuvia specifically disclaims any liability, whether based in contract, tort, strict liability or otherwise, for any direct, indirect, incidental, consequential or special damages arising out of or in any way connected with access to or use of the website, even if Pronuvia has been advised of the possibility of such damages, including but not limited to reliance by any party on any content obtained through the use of the website, or that arises in connection with mistakes or omissions in, or delays in transmission of, information to or from the user, interruptions in telecommunications connections to the website or viruses, whether caused in whole or in part by negligence, acts of God, telecommunications failure, theft or destruction of, or unauthorized access to the website, or related information or programs."
  },
  {
    "tag": "p",
    "html": "Pronuvia does not warrant that the functions contained in this website are free of computer viruses or other harmful components. Although the content of this website is updated periodically, Pronuvia does not have a duty to update information contained in this website, and Pronuvia will not be liable for any failure to update such information. Pronuvia does not assume any responsibility or liability for the accuracy, completeness, reliability or usefulness of the information disclosed or accessed through this website. It is your responsibility to verify any information contained in this website before relying upon it."
  },
  {
    "tag": "h3",
    "html": "INTELLECTUAL PROPERTY RIGHTS"
  },
  {
    "tag": "p",
    "html": "All content of this website is protected by U.S. and foreign copyright laws. You may not copy, modify, upload, download, post, transmit, republish or distribute any of the content, including without limitation the code, contained in this website without our prior written permission except for your own personal, non-commercial purposes. Except as provided in the preceding sentence, nothing contained in this website shall be construed as granting a license or other rights under any patent, trademark, copyright or other intellectual property of Pronuvia or any third party. Unauthorized use of any Pronuvia trademark, service mark or logo may be a violation of federal and state trademark laws."
  },
  {
    "tag": "h3",
    "html": "LINKS"
  },
  {
    "tag": "p",
    "html": "This website may contain links to websites operated by other parties. The linked sites are not under the control of Pronuvia, and Pronuvia is not responsible for the content available on any other Internet sites linked to this website. Such links do not imply Pronuvia’s endorsement of material on any other site and Pronuvia disclaims all liability with regard to your access to such linked websites. Pronuvia provides links to other Internet sites as a convenience to users, and access to any other Internet sites linked to this website is at your own risk."
  },
  {
    "tag": "p",
    "html": "Unless otherwise set forth in a written agreement between you and Pronuvia, you must adhere to Pronuvia’s linking policy as follows: (i) any link to this website must be a text only link clearly marked “Pronuvia.com” or “Pronuvia website”; (ii) the appearance, position and other aspects of the link may not be such as to damage or dilute the goodwill associated with Pronuvia’s names and trademarks; (iii) the link must “point” to the home page (e.g. www.Pronuvia.com) and not to other pages within the website; (iv) the appearance, position and other attributes of the link may not create the false appearance that your organization or entity is sponsored by, affiliated with or associated with Pronuvia; (v) when selected by a user, the link must display the website on full screen and not within a “frame” on the linking website; and (vi) Pronuvia reserves the right to revoke its consent to the link at any time and in its sole discretion."
  },
  {
    "tag": "h3",
    "html": "LOCATION AND GOVERNING LAW"
  },
  {
    "tag": "p",
    "html": "This website is operated by Pronuvia from its offices in Flushing, New York, USA. The law of the State of New York shall govern these terms and conditions and the Agreement, without reference to its choice of law rules. Pronuvia makes no representation that the information in the website is appropriate or available for use in other locations, and access to the Pronuvia website from territories where the content of the Pronuvia website may be illegal is prohibited. Those who choose to access the Pronuvia website from other locations do so on their own initiative and are responsible for compliance with applicable local laws."
  },
  {
    "tag": "h3",
    "html": "SEVERABILITY"
  },
  {
    "tag": "p",
    "html": "If any provision of these Terms and Conditions of Use is held invalid or unenforceable by any court of competent jurisdiction, the other provisions of these Terms and Conditions of Use shall remain in full force and effect. Any provision of these Terms and Conditions of Use held invalid or unenforceable only in part or degree will remain in full force and effect to the extent not held invalid or unenforceable. The parties further agree to replace such invalid or unenforceable provision of these Terms and Conditions of Use with a valid and enforceable provision that will achieve, to the extent possible, the economic, business and other purposes of such invalid or unenforceable provision."
  },
  {
    "tag": "h3",
    "html": "VIOLATIONS AND ADDITIONAL POLICIES"
  },
  {
    "tag": "p",
    "html": "Pronuvia reserves the right to seek all remedies available at law and in equity for violations of the rules and regulations set forth in this website, including the right to block access from a particular Internet address to the website."
  },
  {
    "tag": "h3",
    "html": "QUESTIONS"
  },
  {
    "tag": "p",
    "html": "If you have any questions about these Terms and Conditions of Use, please contact us at <a href=\"mailto:info@pronuvia.com\">info@pronuvia.com</a>."
  }
];
