a=1 echo $a
a=1; echo $a
export a=1
(export a=2)

b=(1 2 3)
let b++
echo $b

c=([5]=5 6 7)
echo $c
echo ${c[5]}

for ((i=0; i<=5; i++))
do
    echo $i
done

if let 0; then echo 123; else echo 456; fi

x=123
case $x in
    1)
        echo 1
        ;;
    12*)
        echo 2
        ;&
    3)
        echo 3
        ;;&
    4)
        echo 4
        ;;
esac

[ -z $pp ]
echo $?
pp=123
[ -z $pp ]
echo $?

readonly pp
pp=456

$(echo echo) 123
$(echo echo 1<&2) 123

rosh
exec ls
exec 0<&2

echo 123 | cat
echo 123 1<&2 | cat

# diff <(echo 123) <(echo 456)