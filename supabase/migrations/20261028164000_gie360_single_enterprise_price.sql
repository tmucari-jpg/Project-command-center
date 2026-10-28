-- One commercial offer; historic packages remain for audit and migration compatibility.
update public.pcc_product_packages
set price_mzn = 32350, commercial_status = 'approved'
where code = 'gie360-enterprise' and product_code = 'gie360';
