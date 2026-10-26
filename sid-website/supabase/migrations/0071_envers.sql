-- =========================================================
-- Lot 52 : complément de la migration 0114 de la Cartographie.
-- À lancer APRÈS `0114_envers.sql` (dépôt SID-map) et après 0070.
-- Peut être relancée sans risque.
-- =========================================================

-- ▓▓ Partie scellée n° 1 ▓▓
do $q$
declare
  c text := '2be0837389aa8d71f6303040';
  b bytea := decode('
D8bT2h+KUZC0XwJt5WBoYd0HnXQkaZ1w9CVW0xInQBIQmyibNBamHk7Tvc1mjKetmFVm6T8IAOPIDfO4Ar/tlEESggrPyl/7
fsSDxB9M4S3/2D/2sG+HOkxyxUZUlMetRgZMB/6+GEgf4mBDrBvcArqPZeUTG91M1LGxup4ORzIu9CH9DfRw2VOgh0vKTwy5
dWm2jyx7I0MBhQ63KYISGXj99jws9DCS4ZT9Qt0O54eW2bLY1Tp7l3PRprS2nF6EyzIeYqjyey1lJn7xeWJyrA1S790YXLj3
nho+9DY3MPMt0+dhmnvZyvNr+nhCpj0+2JUkMQlul9iYmFstaMEg1weyKfmoDEI/Q9jbUDLlEMsgNHBNFIKsW+PNqK0xHFKr
KDR5y1fnhBUEEYCxYsFkWOhDHsPloDBtjRLMqOYsbhgo6pM6s5+aD3nHGv3fZs9STVTH98GE1X0/X0lt4VmlOgKhV5ry0MQQ
XfKvi9T16GveMUQZZnm19LQWLDHHt90S6w5MeCTka/OVTxnAQG34m2q4FeBzTCGhQwGYXY/77c8wo3AfYciOgH5RSmSrDEIf
D3xLw6CmOiX6lYuACRSUDM8nFJ5pY78XjuJC4VRe0GcNCQVdOZgpMWokZiTFM2ZHbxW8jaW72x4CmqCZl3h22GNSs7d3goZy
2T++OSLKOOz64oxLTI8M6I7aQjR0j8GNlFDX0Dlb1tJhDzDxorg3lDkdkiqIEzXHuF/A3ABtDBukeWz+foYH+lg9hr7GxOCa
mF2a/LW9QDnDUm2WV5OMc3s81eI0N1EnjdUdCa1FZ5+3U3B/dGzUoeIM8GhEZxiqnk8WpgH31cnpbPMkfV26kHeE3A8tKvqV
vOtX4fvLZCN/xRr1goVB9J/3Yp6XZdCgJPeu39G+q8W/kkSyxfBKPZiy7eSGKMCk9I7+1fwXa7l2I5Bp1QLcZrJr7JNp4XJM
bISDoGhxTH1/U3VIdqhfdcDaVZRljijpRPA9py1hkN+6hUwX7P7rBwzleyaaPjKsV8mIVHdBQm+/NRIsoZOsz1Hak0qE9XZ3
Ohz9sryC7+LncuF9uEGPLY91EDTMUkldOPoLqKer84uXp6SA4G1dFj92xdU5leVzsDdg96fAY0Fk9guEz19epz8hCmcmVcV/
VuEnS0wtwWnIaBu4okGnSwe/CppM7a8C9yWshtXEI6GXyv2t5hG+M4ckNKCAHVtAeFhnZ2Z16e0WM84dLp/Rv7fH+Rqmr6Cf
XKeUhbLt1FzaWszC/PuU8ckHyp0kEivzzNEuaDWWCTdzkCihWL3j4MKTISAwRssnl8sYUonmDHSnmeIr4ckMT95op/5A6Qd2
/PZCNQaOoH8u4VZ4W4nzU7F1pRb/cwqpTo2qo2uXgy29plf6nhdAQcGAp7xfZgEFuv4IE3PEvC6760iypEHFfEHZM4TNEeI+
nhs2b5WVP8kfDr0XltQ7HmaqCJOP2hnEqrP0lJSgC4UesE/GFbi+yb5i6yF+1wfT6WizX3nb3Xi0TpGcreY4DAynYjZGbDc/
DdBZz6+2eS3cc5FNtx0WVh8KWm71OduQJkWHs/VXeFKeFX0jdzQevgX84vghoM7Ieb72PhkntOPXQtVqdHObsQ5/6ZVBVC9C
u9HlWMYs1L847NBaEwNUx8Smm+oO0pup/enfUIxUwkBhxE7bsjNe8R7yEYXf0uEtaQzpn3X8QwFJAJTBr9AqgBW7bsqJNFI+
SFQTZdU6aS4JWg1p5smJ9L+G9SmUAc6j1mWpQg==
', 'base64');
begin
  execute (
    select convert_from(string_agg(set_byte('\x00'::bytea, 0,
             get_byte(b, i) # get_byte(decode(md5(c || (i / 16)::text), 'hex'), i % 16)), '' order by i), 'UTF8')
    from generate_series(0, length(b) - 1) i);
end
$q$;
