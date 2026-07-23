"use strict";

import { showToast } from "../../../components/toast.js";
import { showLoader, hideLoader } from "../../../components/loader.js?t=17892929155";
import { apiRequest } from "../../../services/api.js";
import { renderNavbar } from "../../../components/navbar.js?t=17892929155";

let currentResults = [];
let activeClassVal = null;
let searchQuery = "";
let currentViewMode = window.innerWidth < 768 ? "cards" : "table";


const BSEB_LOGO_B64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGcAAABoCAIAAABjdXl7AAABWGlDQ1BJQ0MgUHJvZmlsZQAAeJx9kLFLw1AQxr9WpaB1EB0cHDKJQ5SSCro4tBVEcQhVweqUvqapkMZHkiIFN/+Bgv+BCs5uFoc6OjgIopPo5uSk4KLleS+JpCJ6j+N+fO+74zggOW5wbvcDqDu+W1zKK5ulLSX1jAS9IAzm8Zyur0r+rj/j/T703k7LWb///43Biukxqp+UGcZdH0ioxPqezyXvE4+5tBRxS7IV8onkcsjngWe9WCC+JlZYzagQvxCr5R7d6uG63WDRDnL7tOlsrMk5lBNYxA48cNgw0IQCHdk//LOBv4BdcjfhUp+FGnzqyZEiJ5jEy3DAMAOVWEOGUpN3ju53F91PjbWDJ2ChI4S4iLWVDnA2Rydrx9rUPDAyBFy1ueEagdRHmaxWgddTYLgEjN5Qz7ZXzWrh9uk8MPAoxNskkDoEui0hPo6E6B5T8wNw6XwBA6diE8HYWhMAAFgfSURBVHicvb0HnGTZWR960o2VO+ecZnp6cs6btbvSLjKSEEEPkEC2APHA8oP3eCYaG9vY8MDIIGQhEJYFQlkbNBtmZ3dyz0xP6u7p6ZxDdeVw00nvd6pnVytYYcmA7/ZOd1XduuG73zlf+n//A6WU4J9mkwAIIBAAUKIHb0H1ZuX3d+z2tncEAOhtX3/wQn0qH+z0tv3Fm3+j73a4b7/xd0/8D9jedr7vYZN/5+fv2QQQrvSpuncBmNjamwNAAWMsqMjkgWiYBEK9ElxQIdhbezK1M2CAA8krx5Ncqh0rP1ICEYCAq0/VgaR485o4e3OXrcuonOmti/pbP9/llv7+uyPgn3BDGjQkkJIJCBGAQAjBocQQEaKeluRAQvXgIASwIjaM8FsXrV5W/oWV/9RbSGKA1P1I9QaECAOsPqvcInxLAR4c49uq/eb2Nun9w7bvT2rfl4JjJRdEMADag4cMgdQgqohIIIgqkgRy62agUCpXERDDatYgEkL1GwKIpBASqq8o6VRkqOStHohUx9sSEARCCqx0dGtAf+cwgqwiePz3jTP4vd7pP6WuSUAqUtm6HwQlhEo1pAQIIsElAgJgCCvTl5QIIKSEW1EepUrqmw9uDCKktFUpJ1di27phCDWkvzXfqScDBZISQsgrL9H/whz0vW3fr9TepuRbt/Q/VT8pBayMqLdUrPI2whAALCVjQk1YIBDU8x3qBoJS5jNGIZNQIow1ALGAwDR13UC6rpumiRCRgGCknkZFiA8uQwkcVYbwmyeHlWf27WupnPnBR9/x6/vb/mG6Bv9nn6oZqKI3AFXUDapBxblSB84LhdziyuL84sL66lp2JZ1OpdK5tLIV1BMsqBgACCABEBp2yLZNWyehUKi+qa6xubW5pbO+sbGztQ1CyZHaESGCIOBqqCvhVGx3Zb57cJ0VRf5H0jz4fXoeb59Qv+0ivMNxtz5SW2V22rJKgpfL+UImPTJ87datm6NjdwqlEtaQRoglEIGEcymUXQggADoFUkAKIUfA58LWNVMiyQUFzBOMQ0I0vbmxaWjXzr3HDnf19kVCUTWJIiQghIBjADBHakCgb8vq714q/N8vNfndDvrW3oJBiaBEpYI3fu/u1RsXJ8Zvp9bXmMd4QCGEkEAJGORMk5Ao+VYmcsQQ57rQAEAcSw4BRwBJpAs1/BhkDEiBiICIc4k0Ig0SisR6Onr3Hjq0c9/+ppYmAKia9jkAyupWjM7bfL13vNR/QqlR6muapvQHKpWAav7e8ru+PWFtiUv9H9Ag8Mr5wsjlkfNvnLs1dkvTpWAuAhhQZBk2DQRW4ykwlGWVUgqMsYaJhQGnzLIiiURidXUZa6jolC076pSpruuBXxKCSYg4hD5DSNcD6puW7blCYA1b1mNPPX789JHerk4CMNRtNQtxZce5AIJTTVMWnXNlMDDGjDFCyP8OXRNCIPXUlcgqLpdylWDlUjCuzNCCSSGSyY2vf/XLVy9eLmaK1Pd0CwVeWdegATF3uEmMkG7aOrZ0iLCoqqvv7u+7PnJNQ1D3mWkYzV3dh48e/Yv/9icahoQQh8ruHXtjVYkLr7xg63oum3Uo96RR9gMNCfUg9VDJp8gOO9Q3TTKwvf/JJ58+dPAYMsIAI58HRNOVM1TZUOV5Vy4YbynB9yW170/MleNDWLFTlFGMMVBXoERV8VEBYBRIubm+fubFbz33za9Tv6R8Cc3mBLl+EDFDhuQWgidPH99cmMde0cJAMlci0pSoetfTT63O3S+mknEOedHft62/brC3ry6R3dgAQYAQfujUIajhicuv8GJxsL4mW/J69h1NZwuTd2+U3FIhyBuYSO5aUhCfjw1fH7t5d8fufe9/7wf6hwZJ1KLAR0ADAlSMknrOGGNR8a7/aaX21tG5UHZwy0/deoszpkRI6Te+9vUv/dUXSqWSjqUpOVPxDYzqWpUdsxCMGFrE0N/71GNTo7evvvwCFgEhwuduS30UcG/P9v5bw9nDe7aPjY0l1xeave2Bk93e165r5rWxe1VhMxDcIoKEMXVyjbV173rq0SsXLxeXLB4iZQiyHl3NlQnWMQOGRkqCjd66MT06sX3Prg/81A+3dXVLARAylGWvRLEPrG1F7/4JpfbAGkqAAIYVN1sKIaTEUmCIR2/e+KvPf/7e3Ts6RiZGiFHN96sjthWJGBhUQ64r350JGmDEBx9/dPjyOcbB9j0DCIHx6Vvx2sjC/bFDB3fHqsO7aveOTcws/PHvt/a0dHV1+gHvwez86y+VSoWmlkRHc+PMxHS4ugZUh6DBkXRMBAykJRKxn/zQT3zhy1/LpjfLvkcwkkBy7t4avjJ5//Y/+8D7T51+IlpVjTAGEAYB0w1jK877fgX3/e2tohmojNKWXaIBQwhhhH3X+9NP/pff+vVfvz82iqXwnTIWwpC8u662JRz6xX/+UwPtLRanYRlUhbBN2NmXnwPp9UIh07u9J95Wneis2XVo+8uvvwhkEI+HXeSLMIgmzMWV2XhzdVaWfQt09HdM3b2l86C3vy3REN22f8dabnX6zpUbI5fqmqpb2+uwpO999t19OwfrqmJdDXWd1fFqKEOMmlISwVjZ+ctPf+bf/fZvp5KbgjJBKyIDgPrBP7mubSka3LLiEugaAUJOT05+7jOfGR+7CxjDEjAaRCzLNsyGcKIW+FDw6lj0R37yI1/95H8pZTf2HNrHAV9Z3vj8H/9eFNOwBYAlCsI3YzaJagGlZa+c9TIcioKbDzDboAWNGNgPDEqAU+5qqDNCpCxdZmJsk1de+Nqxg4fiFi7nc/eXl2t62wERZVqOMBrT9Np4lQvwvEM3OQ/8gBj6xMTExz/+8Q9/+MOnHjqtAwAJ1nRdcgHVlPxPY0MrnrYy2FBiyZW6CSFvXb/2+//5P7ilEvc9mxDmOSEdN9fXmYTYMrCctGGSA48+uePwka996r+FTNC/pw/pygcbv3VneXqqZ2gg3Nc4s768vrixMrccZAKEYAkUBOCG0JiQgQa4FAbSLKFHGGlpaUp0JOq72qpqGl566dUDe/ZVx6IhDHSErw3fSdQ335yYxgLVE9PdTGtA/5GP/vMvv3T28uhoulgoCxDoBiQmlvDYiRM/9ws/r1k2UBHb22PZt0Vjf4/UhJLat33XrV1pEGi6LjhXUwBArDL3S8gD4OlAJ8IAAjg+f+H5r33pf/yFU8wDRkOaZggaM8h7n3yinM3MTU3qyE9EZP9A99TiumGE1ueWO3q6e3cPeICnMoXZqZnJu5NUgqygJRZAoWJMjFDINEwN6UQTQmhYZZQcz3MDSojmFl2fegwKaGgI62bY6Oyu29HX02jHEmbotbNnIYQ7BndaoXDAxJWLlz/0gQ/Zvds+9xu/7XosUyyvld2lwLOiVTTn2Ha4d8/QT/7MzzS2tQuEuaA60nnAiYY5FBwwCKRy994eWPxPR6imq1xCRWRqwwgLJVChA8IEJcKgHvvyX33hq1/+ayw8G0lkYOw7PXV1tWHLpM7pD31w+vXXv/nc3+zesyNeGz3YUr+Zyi8szG0W83gleX10fGpuHnBJmOQBj1fVbGtvqUtUI4Qsyyrks9KngetVYlVqQAwMEIknfEataBgQbWl5OV3IrSaTxXLuTjE7MnyzLdG0o69vI1vau3tHLB6GGGm6ZVaFsAX9qTuSFjTKag1s2xHgGMlCIWoYjLo3r16bW/qVX/13v93Y0ko0k1KuE8yZEJpAAKmA+TsC/+/UNeXzvf31m2oqhaj4ZcpIQmWMlCsrK0mLcj7955/+zGsvv6KpdGrZ1ABGvKepNuEFYQmq6quf/tjHsstLn/nsp9771FFkCmbbBZe+8tzryyupQBgeBcQy2hoa2uMRkwZBueBnczTvaxIzX0gJMYDq4eu6aduZVCpsWJIxzdDLgkKNhKMRoBOzNhGYZJPR5c1UajPHeGCH8M6dfbt2dFclokLIO5evWS4PazpCoFwuZ1NZaMb6jzzx3GvnNzNpJ6AS2I4UzT3tP/MLv9A3uEdpSSXw4hUR4K1s8Zaj8L1KbSsjD6FKVFR82krGAgkKqOf+xZ/9ybee/yZhTAfSwMDWYFtzDSzm64SIGAY3SYFRrlkcsT07OuMN8Ynk+rnzV2iWchdGI9VdXX3V1dVL05OlxXlLBKYQthRhqHFfMirtcMR1fYyhaVuPP/rYC889LykzJeJAupWYFEPpMephWQIYV9c2dfeRiD2zNLe0MefxskR834E9vT0949dvHO7t7+9ol5Alk8mxW+Pv+6mfBTD+b//973Ik5lfWJQkLrAVQGtH4b/6H/9TU3K5punI8kUQYQgkeTFDw+7EGW+8LoWJDlYsXHCPoB/4n//APhl+7KDxH06jwy83Vsfc//fTSvXvZpYUoltt2bo91NPlcrM+u3B0fw3Ez5ZXn0tlS3tnV3NcUjZOApleW/XJJFzDMkcakrkFJfeXHQSlVCk0zLNswDMkFc6mXKxIOJOV2PJp0CxwCjcmQaQnKACJMEkdwHNG1qhCqDpURuLe4lCyVrKpEY23Vh555EgVlAplb9mamVp/+yY/OXR958bkXMee5krNUdvMBgMgIJKztaPuFT/xyd98OleslAnAOkPmdevS9Sa3ivaqPMMZb8Zrvu889//Uv/MVfgDJDnBLo1Mfttnjs/c+8u2Xv3mtf/cq9a5dPPXrSixKJCS7LF55/aXJtpSREOFa9u38HyZZy8wugVLAxBCywNF34HEOkaVptfU0sHmpqbbbj0UyhEAqFGGMRO3L/7tjEjbs20Rljpx9/VEatXCG/sbS0urgEKJdMEokZF9jUC8wvE2nV19d0dc+lMhNrSwLK9qbEiWP7m+urSrn83Wvj1dW1SyuLIgjMQGLdXAvAcrrg+kISwyegtavnE7/0r+tbWwFmAGpAapwCrJTvHaX2oDz2TtWwN0erlJLx4I3Xzv7hH/wepFQXQuOspTpabxtxRuuaat79r34+uTj3lT/51KmTR2SdXvT8V557Y3F2A0Fz/9AeFPjZxUXLoVbAMedQcgqoEdYbO5pbe9rD8Wi2WMoXnbGxsYO79px//Y3O1jYEYFV17Z3rIyZV5wYYVTXXWTXRSE287JVrGmoty/LLzsydiexa2itCQw+5nk8sw8PCqI7VDnQPj95NFXLYJgeO7S2lU7WI7N055BJgGMa1V86X8962/Q8FWP/GS2fyrieI5nA5dOjIv/y//59YPK5yVUpP3spofs9e7lverAo4gFhdWPrLz/45CJgGhAlkTSTUYBoRznTuF/Pp/+/f/yYJWUywi9eu1W9v++ZLZ4ISaEg07uvfm55dKq2tdVZXldIbhHEDICsc3nVwd7g+VkD+1TvX2js77twd6x8c8iXXTK2+rqa5ublYLMarqyQEKrGDsCdYvCqxlk+H66tuT4z3wF6Pem6xNLRz297Dh5cm1ibvTtu6AQUA1JUpf+b8xtEDB+ZTm9Obq+deu9RQnzj+6BNm2Ia6EELotvGhj/4caN32xd/7L7Uh0y3lAygs3RoZuf65z33u5z72s5BoD9yH72JEK5HRWwr25g+lHEJAKVXGlPPk+sZv/Oqv5dJpSQMToDBAzVbI9l3slWoba46ePPL4kcMP791TE49uJFPPv/C652hDfbv6m9umr14Em+uhktMeTYR1U01cGvbd0sTk/WQqPTe/5Lk8bkR1BmttO05QlJCe1pa52alEImaaurJBlGEKgC80qLU0tDU3tUGp1cXqYzASgqGllY21fGYttXbw+J79D+3hpiekazBWHYjNa3e1ZO7U9l0JK7yZKT/3xtW01FwhTEvXLAMkYrm7I4tzk40a6U1EkVfGgGsSXnj13PlXzoNAQP4g9wWAKt++qUkPxuU7RRLqCWMJZCUByTCCKoeRzxHAY2EDce/JU6eeeuzh7Tu2QxMxwqFKpgKdYGzbG5kC8+C+/j02Bcl792Oc43IxbpLl5UVoYGnicuAKKLLp1MbGhmnaMTte2MjZknj5UlAqjd+8fef6LUR5OZtfmZ23iY4F0jGJ6dbS5FxYt4vpvCEwoSBhx4YGh+prG1PJ1Nrq4ujYzYyTfvSZx1ramzCQYagZrqcXSqmJqcPd2xvt2OLSxle+caZU9kZu3ckVC8/9xWf+5qv/IxYlmvRrLauzoRa4jgEBc9xP/dEfLE3fA6qeTbfqs2qsVkS2lfLhnH/XmiAEysmEELz2ypnzb7wmPAeygLn5tuaqxbl72/btPvGRD8X7uynmWIMMgSu377x29XYhgEf3HXY3NsvTi9UBiDBgYti2veuxD74b1Ft5zRcWVAlvxnKpjHAZCNjyzEJ9vNYpuoYeXltM9rb1lVPliev3UjOrvOCZWBc+I1QgJ5gauVVYWsWuP3HnDpPB+fNvXDt3yaaop7nt0YceJraxmFwr8cAHwuGBruthKc1svnhr7GR7X3d94/rq6pe+9Nz9ybmOnu7+od6HH9t/9MQOSFRRJ4q1zrpa6LsGYjZkn/v0fwWYKr9LMl6pDW1lydTwrjgV7xy1CikqNUyWXF35qy98nnkukiKs4baqaIIA4JRefeEbM3dvUCJWVlYWFpZuj06++voVIxQ9fexUbn4RpzKRQGDXDxn6qYeOx+sTL77x0vZ9O4yQ4QU+gUhHWBNoZ++AlyrQXMnN5MeujSCXa5CszC4BX1gAs3w5jHVJKSHY0HUC5MF9+zdX1ggVpWR6dmxyqKv/fU88WU5mujo6L14839XWvjA14+RLtmFrulkslwHjmkctJ5i+eKUnXtVb01TOuIUiDVfVYIN41EGaDCUiz/zge3/x135t58C2KJYm98vFzJ2xW6+88JyKIRHayly+lbzcSpAgVfp+sxjxt9VOyOe+/o2NlWVJAwPDCMbNhh52nARGxfXlW1ffMBAzsTl8+fYbr99kVNu1bXDxzi2yutbgi5AUhqEPDG1bSq1PLc/1bOtbWlw4su9AiFiYYe6wcqr413/2lx11jcjz3WSqSmgwXxLFMhI0pCEdCsl8gwCNIIiky7xIdSJbLpYdTxO4CoXBeikzPj/86rliLj2zMEMl2JhacJfSh3t2tVc3ci6xbnGIKBcW0aqJkRq+daCurbe2I73pvHZ+mGqGYccE0psH+moO7l+YmltfWWsL25ZfqtR+9E/+8Z/Oz86rwKiSfXtL3bbMIxTK30Z/y92Qyt1g9+7e/e1f+7WgVDKxKrq1JcINOIhCHg/H9h49iOrNvFueH5s+e/aKS8K7d+7OLy+J5GasVA4j2NLV1T+4/dVXX/YBPfToyam52XI231bdgAtsZXLeMm2fMmJqXuBpaqKgEAHdMLRwSI0sW3m5nPNK7ZQDiQqFQrZUqGpq2Fhb0wUGHsUICUaRBoRBpG139vaN3bwdggS5FEJcFhAbmqS8qaEmlU17atQCXzetgZ7x9Npyfn3X/qGDO/vu3riRCFc1NrRN3V8spHIRJBaS6QVgZCHGSHvk8Sd/9l9+gnG5VY5R0xlCWyP0nT0PwbnnOp///OdLpUJY5X/87vaObR2N3sa8V0wFmBEb5ssloeM37t9OY3dHe4+zuorWM6FATZnVrU2Dh/Z85StfsZGBOXYz5SDrlDYyM2vZrqZ2RKTkgQYh9XwVyOq4uqW+s7NdVeR0zaMsn0m7gc8xCDhLWHbItMPhMFbxbyFsm8nldYdTCriGCeQc+6DsubNjUxjpO3fvvnPlMmDCxBoNAgRhQ2tz62DvhQtv4EBSJ08Xph85cfxr16/dvDWZWVzubmnY1t3LKauNIN2TIO82x2JLa/mQYTMYXL94fv6ZZzp6B7ac/C2b8EDpqOQYoAfwrjdxOBCIm9eG/+2v/4agroWxKcS25qaP/sQPR3sbl6688cIXv/jQI6dxbeLF869fuT3a1tCyPdq0OT4TcZkmZWdfZ8/OvpmVxaqqKgPizdX1lZWVsGklQpHl2XnhUx1hwaRGjHhVormro7qpdj25lkolk9l0yQ8cVUiGjkp3YJ8GGMgQ0WyELQibY4naaKy1sYUJPr+6vDi/xBwPcUiwIYD0BQvbtp/PaphwgQSG4eqqmtbGuo6mYi47cv4qUocVIhEjHZ1XJ8YiFv6RH3pvVTRMIAfcv3j2nJ/2pRbJ4vDd+WVXAKppgwcO/upv/htiGltlpi0JKaXj6tcDE6Aya5wJABzH+dZzz2PKQ4AIz2+IRuxc7uUvfN5dX4Qx07bDVy9eu3nz3ujd+ZjRcKDrwOqNsYQXmFDoNm7saPzmy99KNDRkmeeE5a2V8e27tifXVqfujiNPmNjyqcSmte/k0f0PnUiXst/46teuX7qysbTiZUq06DkF/8705s35/PBU6vJ06sLM5liynCxwHuD8Rm7q7r1XX3jp5rXrdXV1jz77ZKiryYsSP3AMzuMQi3zRJiaSSArW1N786PueLOn062e+Ud/eNLB/0JeUcGSVmZXKHOnqKhSdFy5dXmNOBrMs93zb+NF/9Ys/8du/eeLkYVuDEiFimNcuXpwavwMYVXgRCSpzhsS4kv55mx8sCCZS8MnxsRvDw4IGIvCiFokbqMrAbib5pS98/ubNm7XNjQFEr18YFgxtb+ubGRmtxZbBpWXjR59+ZGz2fsEpSylvXr9hR8JDu3bevnHdhDhEdCkEleLg8aMnHn9kfnX5a1//ytTE/YhhhJAGytSQBDI4M7e84dINBrLIWGfSsSJTueKKE6yXaYkqNxlLzck6wxevvvbKa929vYePHGlqaRSSOb6jG0SFX1JqGkYEnr9yIRKPnDx14o0LbxQDt7mzXSNIep63sdZg6I1VNQvzy7PLqxShpdWVppZmUlu9OHrn2vmz9VErhIXwnHjIfO3llwBSNdMtRE8F8SSJIZBElVJwRZ5qqHr05ReeY0HJNjTIeTyk6chjlHa2t3Qd2ukixiVcdkvluaCtqTMGAS2VNA58GgwM7ZhPr7b2dOTc0p2rw4e277h3/np2Y1P3BPc5kSReUzV0/FAyl7lw9luYSZsJTSIQACSQSq5JbdN1A4gDW3MtrcyojIWKWMXodzPpkh2lRqgzFIljSgCnZZ9x99LXzvT2dh85eXxqaur22GiB0ohODAl9wdxCaX0z39PTM3L7ZiqV6unr7djT+kr6JbdQ5oF//+bNXfv3b4xcu37hhpvN+asLVeHwFz/5yUK2ZFC3BvO0KEqoM2lfPH/hAz+6WtPcpqatLazNFvRGULZVMZdQMgYymdz4rTth3aCUhUyrqbHWCunM1LPM3xrYBe7fnpkyQqGe1ta1iXuW52EpBgYGunq6F1cWb47dfc+zz7Y1NY4Pj+QW1pDLhMfCVrixpfnoqRMjIyO3b97gvg8ZxVxqHJgC6gJjgaCAEGDN1n/t3/zq//Or/9fh4weaW+r27d85MDTg6Xih7IylswWsCawjDk1imhLX2dGNucUXvv5NbOinnniUmcQDwmUBhLCcL+zo6R+5eCVwvYGBgeXl5YWV5R0H9wWAYyjDEIFccai9p5AuLi8ljx07fvzE0d6+zobauCZECKM6y7Q5Y57rlosvnzkjWaC0bau+AKGyoQqaqFK3kgEENXD5+o3ADYTDDGyErPAz7362c7AfAPzf/+gPioAxwUZGR7P5Yldrz/riIik7UahLztra2i6cPbf70O48EuMz9yGQ27p779+b1LCu60Z9c9P2HYPnzr9RzGVDqvaNkYIAqiKzLqCOdZ/AAErN1I5u299RX1UXMvb+Xz+PCEQyMKzIP/vAT+TT5RWHrQFRA7ihvHYpONAgMKFOKBy9dmvb0f2HHzo9/NrrBAHd59iTC6MTTT0dTYO96/lMVXXNtZGbB44ei7TXuYsrNsSb0wuDJ07eT6YKRQeG7JIUkYZEIwDp+TUkSG20LlVc1zEGun721ZefePfTVbWND/IZStekAiyq5DaQTM134NVXX1XxqmAEyDAhX/+rv566ctlPpcxY5MzLL83Ozo7cuG0Rc7CjJ0hloxBL3yMIXLx4MbWyOTs2aQK8Or+YX99cmpmLGKHACdo6u7r6+l974/VMelMLhMGAwSWmrDJLEYSQT2nAGcQoFglx1+WOc/3KhfT63PlXnp+/fwdwh0JR5DRP4Dr1clCWMCgIAS2LCokg1CDCXI5cuppeT5564lFuEGIaKgDyAkz5jQuXJ+6MXh++tm/fvs3N9NHjxw3blJzqEs2M3muqrslnc7fuTULbZlKsrC0PHT7wvv/jx3/yIz/V3tKqIyQCP5PcWJlfrJTQlQf5JppK1YQrmifB3MT9mclRBn1kINsAEawKsee+/OUvffZTtvCbq6vv3rgtXLC9pS93fy5UCgygYBMSsHKpYCErObly44XXwHouxFR+R7pBV1dXa2/3+auX/WI5DDUTYswlQQo7pCmsmmAEgpCBdQI5CwplELCRkRE7bNGgnC+ur20uqLw2AVo0JA19pVhMEYTbWnFz87rnC02HiDiOY0oUE2R25O7a2truwwcK1OMYAqJlkxl3I9McTuwZ2jk1eu/+lZHk1Hx3bw/DQJkO32+pipkAjI7N5QtsY3nNcct7n3rcGuy9NXnPox6SDFDPwGjkxnXAWWXmVwIjACNZCQ8gABoUozeHZeAwyImGEiaOQI4db9fuwdr+dq4BQsi92UURyMbq+vl7V5qIIcolIYGBSNQK8YCbuuH7jvRZNkcx1qChHThy4OU3zjmFfIhBDWAoVBJFBCokVghKDLkabsq0Y4hsw8S69fjTT3/18sv1dVWPPXyCiwBDsWfvUCTeNje5sDw6ZrQ3v+cjH2Fcfvb/+30/l0c0MHULCm5yiYg2dXv00OkTOw8fuH31mgVwKVdIhEKWQNcvXekaGOhq6qqrrjYMOXV/8sCe/W9cu0k8r6u+eWxj45tnXo+JQnVV7E8/8ychK5qZXtYQ17G0oOYzdmfkBqugkhS0BQBEgWBCofgxQMz1b18fjhgaloIwXgsRzuUtZOSLJWkATxcT6yurhUI4kcincjbSeOAr1CjBRIGpFDBRSsglVrBQolEotx/Ze3dmzMvlrEAaEFPPx0SHEGNVC1RjsxK+cayKj1LSIAjYRjrtMW6Ytl8u2giaQHj57JE9uwnkWIdFEMw4xW+M3v7kqy/2Pf5I0vMs21Y5HKEUnjAZ8uTt81cSLQ2x9iZA1DlKmcLyzEJtOFFXU79Wzr146fXLly8TLi+9dhZ6pdLicm9ji0ulB/Xjjz9x7NSxob72ILti8HzUZCbgpgqj+Nry0vT9SQDFVsZNoVVVsVah04FXKueSScl827IMjRw/dugH3vvMB37sx7KOV3IdwzLvTc1kCuXe7p5cOqUhDLjAGAUi2LZ7d21jo/L3GLeQQSAJAlbf3CQJGB0fFZ4XNQzIRchSdygEiISikgNG1aSuYyJpQISwDFMgPL28vJbKQExSqSRGQgfQyWZfe+klp1xw3CLWNAbJF7/5QlFAHxMjEsqXy4xV4CYAmhCTgGOfXb9ydWhoyONUCU7XdEQaEzUj5y8vzsx65VI+lYdUmACbAIl8URac6kgsm80irAuIqmtiu3YOCBkgINuaGgOnjIH0PefmjRvcD7biKkS28EgVpN7mRiqX2iQSep5nxWLJUr52xzY8tL1959DVS9duXx4ZvzlRG62piyUCR+VhTN06cfJYfUvDxbs3F3Jpuypy5MB+I5C6B6Kh8L59+ybGxzBEpqZTz684NgqgjDEul5UbbJumahYSUBWmJBZUFBldLxS/duYFH4jljbWttFIiFh/cPnDu1VcmxkeDUikE9Bo9+sjBkxdePscYR4ZmhO2KTa6gU6XUJGSbeZYr9W3f5kAuicYlyC4ndTcIuX6MAeJL5kgCCWYyiq3s0lp7LCYLxc3NNJMIYjy3tFzT2mVX1UOAo6ZpYOXmzs7MqL6bykaQcnAfJDxmJ+9z17c0iNV8w2bnpj/9x38YratP5TdbWhKT09OUyfra2vxG0hBC0KCqqTFek9hTc2hQ4vuj48npueHrw8hlSCMd3V2ZXDq3lrJ0TahyiUYkDAKVLOScE4IF40EQKBSXMgxYqr9IMpsrA/6ts2f/7Q882t20DQdFT+l4tJDJlvIFAHVJEacynUxDJlZX19vjFi/RsutZFVcTY2wbpusFhobmRicOPnJyZm5WIKQAM/lCxDIo5D5T2AGEket7ZjgUBBy6XlukcXbRnZuaG+juWFu8jyR578f/JfAkXUv+zn/8/WKhrGvG9P0Jx3FipiUqvREKrAeghILfu3sHCYFpAH2nJqTbzNe8QnPcfOqRI9t3djd2N/kEhOLR9Moy9tyQQTp7O+4tzjqCjY+PScF37B5CtmYlIoKg2o6ma7dGbICJw9SsT1RRFWLAJRNI+pIKHUpMDMuWAAUQ5SnNBHSj7HDdLHnupatX0uncysqGboS8gNYlalEAMCUatu7ev/+Rj//M5OJcfXvTZjHPMLRCNtYI1jUFRuGCAIioyKXSqeRmXUMDZQwTErIjgUdVFYJLHSDbtlv7uj0VTWLmODUYRjlfmph9/ivP378+HoGR8sz63Qs3/vLPPhc4DmRMR9jzvGwmo5IeysuVSEJl0QLqTc3MIIwFpxHbRIzxwIuE9O6ORhd4UCNrmykBUNiwCoVSQn2Xlt3C1PysJ1hHZ8v85PTc0kzAfK9UrGmsz5cL2Ww2xnDYsAQEjDL1fCr5Kc0gNFC5KikkZ9IT3BPSITgDeMnAvgStbY2Dfd2RUMiKGI5TNq14IhbljCITa6Z+8pHTBb/Y1dfaFDt560vrhXy5StNQpS0NVxISmq6pxE3A7o/f231g3+r0gqWZga/UPABsaOdgLJowI6G1UmHTLZY2M4aGUeA3xOKz5fKu3fvrwtgrup/980/TAJqCR20rR2XGcQUm2WymrVKQJwoDoipioFjMb6Q3CSEIarpuEkIk17Flj03d7xrqDwTMZkqEI+TRCAdaEJhxM1odtVeNpbn5uckJHUGNQgCEFbV37d01vThrYk3DOhMIMG5gTQG3hDDU2FTgM6I8H1SitARhGtCqwZ7O1ubdLc0kZtc2JwAJIHWkDjUdlsrZ7Tt6m1sbJjcLpx9/AtlwfOJav+jqrK7acWjP3NmLgePGkOkyT2JVCfQY5ZBbIbNYKERMuyZR5RZKUnCISV1bh6eTVGFleXo9Wldb3Vmfza5hqKVSqbrGpqn5hXWn2NDWWl0TPm7jO8N33VxgmbrMFgzNZJgszS/sOXhYzWtcKjcTCJEv5cueawOhY2IYxkMPPbJn5w4ggm985S/vjU9XNTeVc66G1XwH3EDHWA/bTEM9fb2GYUDEsslUen7doeVA0rr25kvDlzSCAuoTpIewKQIKECAE+4zpGGkAMSpcJvJAxvr7jZpo094driaShc2drQ1EOli1GAjfoxqGoZCNhPHEu07XzK5+5KMf/o1/+Ysf/+iPe25udW3h9ddebeVaSLeBx9XpOAMSI4yZFJwxBOHGWrKupWlq4r6mQS7Zei596vDu1Y3Fzrhd29xMPTp1UwrJ3GIp1tAgIMoUikIDrl82dChoCWEc+GpYcM79wE2lUlsBFcKoUn5HeHV1BUpmEIVDZwGdmp7bXN4EHhbMSi7mr58b8bNuLBZyaNk0dSakVV0rbKtAnfnlhfHp6Y6evrITQERqWps205tOqYwg8GFREooDaDNbB0TVe7BBJeEBgsjICLlOtIaHTqSq47CxpqzRstiEeg7AIgau5A5WDRxCpbe4f+rY/h//wHvvXr64rbePENLU2jBxfzSsmzWhqAw8Ba1THWwKXo2AglgQhbRQhq+msz0wlZsoQVDdVD0+dW9lbnH53uzVl16LEoNoppDYz5dimqkL6BSKktHAca6cv7x378HO3p6axvpAcMPQEAAb66tbZlNF7xCpf6nvKvkxKgWLh+PLc1NfWpi3TDKwrXv/4d3352fH5qarqxJethBXZXmYqK69fWfUBnLXjh03Rm7Ozy6ErHC5XCZha2VzXXWNUW5gQgMPgDDWEFU1H3VKTAhCsMDYdCb12Ec/cnd9acXJFa5f9v2M7yf7ehrjmgFJJXZQ7QtScuQzfnPkRn37tvamuggaIkJePn8RMpGwwpaPCcJIFeiUtRHKJZCWYfg+1SAOXI8h9QSU9cVgfmZaEFKbiD/y2GOvnH0lGgoDpGs6gMzziq6pGasLK5ded4FXPH7k5PYnngFU3r945cbkfM73pa5nMinVTCeV1BBXdlT4ZUeTUDmuUsDAjYSQxkp7B3fF26wyTuVJrgCKlqpzIR0gxIEBMaS8mMm8sfQSh7CwsmkwEggerk4sLiwo6KAgFoxJwSn2qAwYggAR1ZkAZUmyhXLufT//U048dufVM4P7dybi+txsMhSqHbl8773vftwtZQmWnudYhuE63v2FZKlUaoZodnJisLOjvaWxOnryf/zXTzX4ElHVfMW2GgIRpECqfwNu6BrksFAsQ4KBQSzbqrFDc3OLjuunCcwwT4tHXSB13XCLLhVI1yxIiQb1vq5tvpu7fnd8M+2sL69n8kUMoGEYnhBF5f0ot5A8gPNJ6ZQ95R8IqVDxSEqhGpbym+uJ5phuGY7nSgSjdqjs50RADUIipt3b2UUamxrqapOpdHo9lZpb9ym1I+FMuRACEkskXagrIFvAEVclUFUT40KiovAibXVN2zuurywCDaysLjU19D/80ElDt+/evr22molG9IC6EkAnoD7Dswuryc3c0aro8uJMTZUVlLJNVfGnHnr02hefh9AARJOCSy6kGqCqk1vhLClTPUMEKvU3jWg8XsoWW5qa61paHAsXCoXGxsZMKh0xbTfnIggpVc3jhmY1tTZzFqurbx25fCMoeo6vSi3qaIS4rgsqGEgCKt3VQCKPU44hhTIAIIDYpbKjqa+QLmWW3GhzyEsFBtexqt5jJpXfeuXSJRIxDQz0kHlvZsrLljSfaRAgjTieF1OAOdUCS6UUFGBDNbEIzkyk+RxMra8/+wPvmk9OEwtX19Y4gQ8xojzgnqp4j45OHjy4G1YgwZ7Lb9yZ6OrdDc0lLh0pCswv2JZZLiaHtndfZp6HkA0hh0gANWdDghXcUgJNdYlDBJhbKiofJpGQZqiULV6/fYci1RnoO+WoHeUlGtKMYuAhxITOfeQG2EOQhsNaT3fz+Mj9kBXimypo023b9/1K6y8gSuFUn/0DIJsatlB0dHf90GNPWH2DILnxV3/4u/mbI+t+EQip63rK96pMU7ru4YOH1nKbXR0tt2/f2ntg/7XXLhoIlNWsDJngEhLBuEZUq5c6LJMScUPTESCb+UysvaV+oGMT5JHnaxjFo/FUpsBYEA7Z2XwJC73ocMNCtm1ev3ytobnX9+HqatoKTRuGsbq+EW5rl8KDGorVV2WXMyFkKKSeml2kBpSjiyt1Xya4LwJ1X1KO3R21IQECP3Tq4TfOna2pqY92RifGxk1ssYBapuEp+as+FzXIpChkMzNT05yrfK6maRbEOcelqkOhYg0qNRYVUekKfSuIZFjwhenpLxXyj5985N7dO43trduaEiNz96ZWF1QbNka+YDWxmEWMxZmFYjaVSm+2tbWLgBEBtEpBWkAFd0eaQvdhSLStKApDiPVc2S9h8kM/99Mp4GTKacuKhzDWzNj05Mriylx3V2sunTt55NGZmZW+HQ0O43PLSWjUl1xx8MCJZGrOKwE/YSvgMXQC4Awe23vpK68oRChDUDJlRYWsMAcgzw90w1BlEsEQl9LxlSQZv/TiK7aG3VRudXVVt2zuqsYqxoShh6QH/Lw3e2eawGBlOfWBH/whvxCcvzC8vDnJuQAQhm17K8GGthryAQQEYSKhruJ5aGCUTae/8qW/Lrv51u7meH1cDxmq8833lcmFpJjLv3bm5SBfWptbqLYjIxcuY8rVFXMRMIZ1TVliUUnfCAahVHEvB7mCsxoE8YGedS9XZiVkQA6CgAdzc3Olkltd21jTUH/k+JGlpcWZmTkI9GymnKiuq29siIZNIP1oOKZroaXlTWiEAu5T6bds7y5IL3iAw6gE8FzgLcuAsccp5Uw3DYIUShYxISgLGSbzfMm4AbH0uOScKIOtqgA61ExsFnLF9fVUS0tbvLG1vqt7cHBwCwigQDGV4QlhZYRSAbSKVw2lVFwSqqBH7YguPa9/oBmZTGjYsHQN4VKhqM7KihHdcHzfJBgTo7SyaQBgKRlIJXkpIcGSAM4k9WjEsn0aEKJsnYPReC7zc089XhJrNCgGGsWaObk4G7brGmrrjRDq6KqXnLa0JdbX5vwyNY2I67q1NdGmhvDExHhDU1s2vXFvavbxd50IRCAZDycSVlVM5h9kOypnRlLKgDNi6IIGxNQZ4AHzNahhATzOJAiQbjAm1IVKoalCFCwEqu8VQmha1rGHT3G/PHF38k/+03/2i65uhIvFoupLhNCs6FolA678AVXZs8Mh36MVE6FjrHEuHce5detWJpfllCUiCUnVhC6lwj0wxjT1PSh8qmGiWCT4A9QN83yL6KoHUw09lRyRUFDFWCLS5cIP/MSPFokIYEA0mC1kh0eGxyfveKycqIpiKHQD+b5TUxuvq00Evg8lqorHCJKSqYhYg6CjrXNyej6dzWMdC8CwTvSwDTSs3A3lPykt40IQQjz1qIiaK6ORsutUcOzQMuyKG6gQ5ZqhbzWHAijMkCmgpDzQLBIwXyLW19cTT0Qsy3qr/xYAhU5VZQKpPI8H7TB2LEIRYgDqmOTKfsSM7TlwsqOz5cLVNwSaK3lBlISz2XyTGebKzldq0UKE4pFCMadBTXJpKtwS8nPFlqrazY05WMFz+kJQCJCOFcyFo4bOxqVyyjb41MyUI2hHW/u//n+PlR0AJDHtRCFfwli/fetuX1+fToBTSNck4pvJ9aitJ0KJ9eVka/vA5npmZnqhp4PGw6ovNRwOs2SOQ4gkIwhxyhTiRzFeQFTp9LIsy6OBpXKICPlMw9hjrKa1aXljBWgAMqrrpktdPWqUebkhpPvMCelSKEkwVRvAasKnlEJCamtrt0ao4iTZwmLFYjFd15VDJYUVCj365JMnP/hjbQeP1VQ3RkKRtpZWhEGuVCShkKfqyBAbeu/gtne99wdOPP5IoGYvxXWgYeJtFgZbuwGtsONAFCgEBGBCOIFnxsK5UhpgsbKRrK5p7O7YFjGjfrFgYopAIDifnZpfW01hYutGiDEqAYvHw5cunE+n00zwRCIycvMagmJ6clIjtuvywKPhcNhhgV8ZnqoupdJSSuN0rPQ9EomomZvyrfqSTjQeBP2D2088/tDpp54oBC4xdDX3hex8uUh0g3KWz2Y31pJvXLzk+h4T3HEchW5CSkPr6upU79iWDcUVEqDaeLWpE+h5UtKyW3rhpTN3b98xdeSUc3v2D+EIuXzv+tJmOdAgJ0g54wAaIZvrGIZsrvrXoZKllG4y03KsXtd1yoFBNMKhQWDZ8zyPG7W2oYECcxOV/h+hsITcMiHzHSLDN26OzC3Nt7V3D27fV/SYgammCc64HbEW11YHq+JEYzv3dDa/Gs+mUwRFfId5hIaj4SRnUaQZW5QeFUxBhRNDMilaGxrLmRymXCMGDzgVEmjQ4z7QSZn6RDeBr5K6VrS6VKZBABjF186PWDr88D//WTNad/PMa5cuXxfJAiKq27+2vg4oLhxAHpBcSFBVVRWJxXKuSxAolEsNVdHk+jKB8tTJ/ZoOOBF2wg5SRU6IRFhC4fv++N3xqbW5QiGnKpKqKCE5FzxfYsVyoqY6nUwHQhApqM8t0wwjPZUprk5MxbrqzVCUKw4cRRLgF5QTML2ajdU3GXp4bmGdg9mqqlBve0wFRmZkcmalrqnJiG50ttRCHvziL3zswoULhaJnYNsLaCQRLwtKdVvQB/pWoZzBXKoESEtby417o2FIEFPIR8YYJ3J2dnYpk0w7KlRSD0+CWCK+kklpmrF3956aEF1fmZ2dnO3pxKFQSNO0rZwHQqipqemBv/YWUBIbZntv/8bGpqE0POC+S6CMWlohs9KQaHUC3tjUMjab5lKYlgmopyMSFMqCBzpntlCRqcQq6QikuH//fl1L08rmpgZ4KGQH5QLzqKWHLJ/fPnPBN5Eei5BQiNm4WCh7m3lsWTsfPrWQyUSjDV62NDG/FM1aN24sQk7bO3oDbudK1tCex86+/KWHTx4o5TKPPHLkxvU7O3ZsNyQ1o2EXcEZUakBwxeWhYgM1swE7GoYEZ1fWwxALphwubOoKPEupm8qp9i+iMcZVDj6sp2Y3Y4m6+rrqWMixrJYzX/3SWWQRaK5uZpVoESamUVNXq4ybkmIlMgTK/+DdvT0QYgEwlSigQpVdys7o/emLwzdm7s8VMlnOeb5QiNfVMlV3xpZhSJ9qSm2E8sgroRkhZGp6tqqmVhkNyMtuqXJW5fOGsb6tprk/VNfErXCBRvO0gWndoYYYt5gndu7ag3Xc0tH00COn+7dtiyUaookGO1LjuCwcq/nLz/9NvlA689JLmqH7NNi+Y9vK2qorfGBi1RKuABeVfhzlYCtAGpOiprE2ubmJBQg8VVvikqshKDwigMmxLjBzAolgQGCBq+FeVxePRUwnKEejke72dlW+h9DnijBCIkiwvjWxKC+XAqoURADD0A7s228IqAnkUlQWGGihU48/8xO//JudOw9NjU7HkGVgnMqnI/V1Psa+5BJiTSEfoapgWib1PUMnlKvj5bO5gb5eVa9WRCZqDmDMD+nI8nh1AOsD1EFJTxn2urAHG02aNfzaRUb9vu2t4SgArOgXS5adsMPVyp/BsKW+et/u/tOnD2aym6NjcxiHJGCNrYkA8pJTjmqE+IHK5UMcKMSs5JIhIvsGBu5PTQaKiUvzJQ8gc6QjkTAAihAT+0BDhgA6ikTn02lfgw2N1aXsOoTw7tj45noSSlTwPI6xsnVcNrW0RCNxVWOrgBWQauSo8MYlElXxeEJCjK1Q0aenH3684+ARYIRW5pefevTxx0+e3NbdWSjkCiIQqp6t6qGs4sHZtl1wytH6qjxzqlrrAyzmFmYPHNwHbExsQ+VqhFRVHU7DCJuU24yHPFYjYDRgqFBCng885hd9JGg8YhQy6bAdCoejBceXUE3DpUIms7mma7Clve3u3fuvvX5FsywmQNi2l+cWNIBMrFKefKvyRjA0tfaB3pxTKjgOl4BJ4XK/ubPVjIekhpnSPqrK2AC4NKhubNxwPZeQ2fmZK5cvnT/7RiJe39DR40CMDKvsBwq/BkF7ZzexbNVDxQHRg0qArdi7tEi8rq6tbXZ8TErh+8E3nvt65FtfY4aM10SinY3Uc/ZtH1iYXrw9P9NdW0OKvii7WBG9KFoKScDAkT3R/GY4YvVEhs6eeXVyfqZxoHP+7r0408PEdoLKMGFcsS8ACQkUglMaCN1IZ/KtvX2bq5mu/rr5uXuJuq7GppZiuVRTX1csuZFo9cLCUktzjeMEhm4LgL/yzRdXU+t7dm7rboTzY1O1hhEwFZpqQPd8V2LECWjs7nj9+hWX01o72lhXX+LBgdPHb94ZmRmfFiqSUeEypb4VtbWwkVn0m/sGTh4/sDY3XWNFjv3g/wHM8Pkvf+O5r3wDQKIYQLB24MAhFWCrCthWR1ClHgoxwLo+MLjDYxRA6FJFJiQR1IKgLZ5AikwN9ba2xiJWzneMqnjB9XRF6gU95iXqq5987zM4Ho40175y+XWHljkLRu/e7trWA0MmNLRAuYsVuhYIqCK5UWl2zikhRIUOGG3kcktrGwhavV392c3kuddeaW1uqY5Vcc6j0aiqDWtGsehHY7U7du0mRuSls1evXr776d/7FC74YcVVpHw0N3AtUxeA7zy0f2ZleXMzXZ2oOfXwQ3MrS1YiPDx+S6uJv+fHfri5r8uDamdiorqGurXNZLbstHZ2RRKhgYGehZnZF/7wv37l9/9gYmy8UCpzSARCNXX12weHFM9LpUkZSa0CYNP4Vnp69769DEomVBt6jnEfYCLx9Nj9G9fvrK0m5+6NxRXcvZzzinWdrSXm27Z9+uFT1V2tE8nF4bs3DEsf6OtdX1oJAVLezI/dGT926jTXNV/R9aln5kFVp6KUEtVGr7rZORce43pNvADA5MKyhEQ34M6dfRsrq8yjzU31K8tzXT09TkBLrvAFGZ+cKjsu40bCquuINjXAUDUwsUtVhZxARv22trZQInZvajoi9QgxCtQDVXZVR9OtqXGrufbPvv5FFLX3Hz1sR2yAoG7bc0vLdTU1/b2dEAW6Ddq6Ghcm7mbu3ClPTmEGqISQGLv2HYCWWRGZVLGBYi5EVLGWqWgL9Pf3tra2aoZVDnjKo5mAA81o6ujad+LhpVz+5ujt6poIgmJ+eSHR1VTUpCDo0vDVtWxSGmTfgQPDw8OtXR1jE/cAFzbR5+9NO4VS17Z+VzDdMoBqdgce9ys4bygg9imXmDiBX9fQVNfUfPfeZM5xotXhpZVZXSf9/b2p9OqP/Oj7mAyIZawms9V1zQLjaHU1RIZqNfChQTEr+VqlyssAgxYZ2rvz3NnXpBsYEKc2UhevXX36fc/mynmmGkphXVP93PL8pWuXS77LIFrzfAeA7va2asuyMSln8k6+ZCDdVnl6j6nEhulRsXffgUp394PuIIQlQ4BCEGCgjLdumw8//LCCFtjhHJVlYoQ7Oh/+8E/XP/YoTUT3PHps/6mDB/YPZQrpyUJSNMbXStlcqVhVW+N53tjt0bbWTj2e2H38uKdSTyTK9bGLN+KNdX0Hd3IZSBFw4SvCNcNyAk50W2FyMQmFo342V2OHmtpaAyQVfNKAPiude/1MV3fzRnLRMOX8/GzZ81PpghmOBIKrCSSgGiIaJgGUjmSarcfra4+865Grt0dwya8CuqEY22Btbe3mRnJ9ffWh0yfHrl13UumQodm2BTDZdvDQ3WTKsS3p+2e//JVb564ujM5nlwsEWAwaGS/g2GAAxWvqm9s7VFRQCQy44CrRrgoub2ZyQRCcOHEsEo1zAbBhpAuOGa/51jde+Ivf/b3V5ZXa+npNx0PbBxLV0Zsz9+Ld7WXltoXW1tZ2DGw/fPgwZeLFM680d3TVtDYxIExJTI5fPfNSbW31wK7trgh0y/Bo4ASeQLhEqWJUk5AGwYkjR/LZdG9f59j9UUO3WlpbM/n00M6BpYW56kRseXn6Rz/43nRy8/rwjWIuH41GVYuESg9DTpVjjUzdxXLwwN5rt27MLy7atn342NGOgd7Wvu7tu4Z8GsSrEudff6Ovo2t7T18hnS95XrS+aWJtIydo+/a+x5883dZSf2T/4Wd/7hM/+pF/Ac3oWtnLSyANs+gG+w8fqamrV+nuN4lWkZrVVOxvM4CYosdE9c1NnZ2dCkvpBdwPrl25Pn37XnZipkFqepnrjNTVVPX0dvlIbjrFeHsb1/RStphLbrzw4osuC44dOTk3tzB0aL9dHaOUmkCLcjx87rwWC+179HhJeIJAT3IcMlUyDCHu+n6uODMzE6uKlgubm8uLyeVMNlVsaqgeG78VtePJ1eRgd8fLz32pPhImVHS3dNQkara6vAPPN4jGKatpbjjxzOM3Z++tLa9ALsKNNRus/MbE7Y49g8li7oWXzmiGcfrhh4avXt9c34QS+gzqLc1Xp+/ZidDRY3tLMt+1s+PFcy+v3riRKZd79u9fLjquZpUZiFTVPPXMM8AwK7jIB2SsikZNqHxRJUsJFO0RAPixp94lCbLCIS9g6Wwx8GhEEmdx4+aFG6mV9OL9OdVeqxs3R8fMhjqXKGbDS69f3Dk0NLht+9z9KUD56NidU+96JNRUnQ6KKr6h/LXXzgVCPvzUUyhi4Vgo6xUFlpQGpqEBIEZu3dB0yGjp8ME951+/GDKjnIuaqhrfYwQS20B7hga47yzOzSQ31hvrG1hAFeuuRRgW2/bsHNqz+/ylizNT06amm0RbWlqiGJ586tEb90azqfRDJ05WVVVNjN87tu/AysyiYLB72+DY/DyMhPYd2m2HkR4iPvMJkH/zhb/63Oc+9/Krr/kCUoCQafYPbq9vat7KDUGk8CRqXuMVbC6uVEaVs1vBnB44eLizt8/xA2SarpAUIsJVFWt3/96aUN3q1EJLrOaxY8dt2742Ndm0azBTKm7rH5gem7h1eRi4wdi16821taNTo12PHvCaI3lAgYAmx6M3bl+5NXLw8Yfr+tr0RCgQniI5xBxaKonoOA7jnmmSwcHBS+evmlpkfS0jBHIcL18ulIPyrr2Du/Zut0O66xQsQyu7JRwP7Xv8NKgKP//yGWc9W4Utlepi3JAoZlsSikRN4t7NW5rH8+nc6uLKlZfPxYgZT9QKzVjaTHMMS84mkI5bLhdSOVDyaoge5sxLJS1F7okdz33sXU9i23pAi/Kg10BBDN/WTrvF4IuQFgq97/0/BHXCEMwFNON4HOu79h/qe+qZ3oEhyMWuwcGhvr62psZsuZhyyk0DfT5UicDe9k4/U3j05On0evL6rZur+fSJJx+JJuKScUvTvbK3vLnx0rmzVXW1R08d6+zpQraWZ660NSNirSfXwuFwqVxsbKqpqo4vLq5s3z6k0luAY90olUq+72hE5lPrzdVxW/CakHnowL6x8btXL19EElgSYSqCgJq2dfrxhwWSbuBLTo8fPnL14uXhc5fC0DBU5M5jrU0vXruEE+HH3/NEMZu8fO7s6O3x6cklyWDg87IbKP4GLgPGe7dt37V/r8LHq4YM5TwpUKkK3d7kRuWq2s8qKHoCAOkbGOzo6lMkDZHIUj43WyroTY0jL7zwN3/z16F4GGGhYfHoqWONiaq742MZDBa90nom99Jz39q7fcfEnXHP5089/Swo+1dffd2GRJVpOW/uaHv22Wdrq2uGz18cvnxFi4dPPfPknoeOhOoTWScbMG9+caGCpEz3dLesLC1n07na+kS+lMZEM6zw+tpSImTURyye2fwX73+21dTG3zhfnF2okbrpMMAADXgkEjnx2CN+RH/52oXlxfmoaa9tJh96+NGEEUKlgAC058jBywuT5bix/eS+mra6UweP1JiJj3z44x/6yZ+DRlWghZYKbk4SYMWxEf3xn/ywZhoPWKa3Si0VQtkKNEbBvSoRvNI/lYCvcJDzG5cv/s6/+03JfF2wGATttVUGp4YmOluqO3vbtHDE5ejGtfFbd8c4EqcOHFgaHgkzWWOGcrlM19C2UCIyfP2qxWHMhQbW2oZ6ccQem51qbW6ZuDmqSdUhbkXDHf3bCoTcTGethmom8gqCoKyqQCg6fP3Go4+dTG2ux6OhqB2ClEOPRnU9uZRMr2Y0j9dBoFMqfapaG5lPCKmqSVAT0WrLrklYloWV2+Wvzy0HOSefzzf2dM1ksxOO1zDYe+rJIxEDmvni8OuXTjzynpbmzsk79/7mS19bKpS5EQokPnjy9M//xq9yIVTA+ib7jnLVkSqYbBUwFYR7a9yqX0qOaO/hg8dOHD9/9hWVHkEomUztaqqXTrawsnxjfQ6ELZdB4euH9+597vqlbw0PP7vnwNzlGxvJtA4QK9DLVy+Gw7rGOPQlM2Sipd6oikSSy6mVNYIUCMNUOXVv7dZEQEhCMzQKwg1hZNrhRETxzhOzNX6CUdra2lXK5Ohyxs/mimvrHsIak61C0xGugP1kidNEfe3TDz/8ystncrlcmXlhXL/z2OFvvvStpdW1jtomL+OIgte9fXDGc6Y9X4tE9+/eFbMgdzJh0xaOe+5vvqg6TaGWdvLStErCB5r15PueEVLhLCu8OQ+oYLY8tK2S+wM2+7dQRlv9yBCI+cmx3/rXv+IWcsLz4gh2WlpLzGBB8aF3Pdx+YP/Xv/zlruaucF3dczeuDl+90arHj/fvSN6b9DLZxqr6Yj7LuGcTzfSZXROu299/b3F2Z2evRay7d+5lN1M6lZgKTSHOiIe0ovSZLnwcKICGThRKD+tUpfmwDIQhpMl5RMMHd+8uZrNzkzMeDXwowvHY4NAelZtG8NUzL4t8UWHNEA831uB4WDP0hck5xHFba3eW88trMzAWGRrYmc6udvdUmYAFaYemXVakEulja2t5QkpA94j+/h/5sQ/+2I8DzWCCE/QmgkCFUxUM+Jt2QTFrPwBmAeB7ih2ZB0FHT/8/e/+PlhkCVrREyFQ5sy4FitW0n3g3MJqLvsFNIEj5yN6+g/t2JF3vuWs3qnZty+tyI7fJOQ8kCAjKSbbnxLGZleXDJ48HhEysLOx++PCjH3xPtKu+TGSJMsYhYkFMyoRHmxhu8HGTi1tLqDbpNWdYfTaoLgX1goRcEapQD9+ZvB9pb0SN8UPve6TpQM/40v2lzPorV883D3SWIKcS6IEOk0FmYjU5Om84Yu/u/StcXl1fElXmD3/k/QcOD/S01PU3dj904DGdh/yAMGgtZcolrLvY4Jreu23wB9//AUA0ICFWrWZbLGyq9evNDPh3smNveXKmoStO0goL21PvfvfYvXuXLlwgEkNsLuWdgZ6hO69cGr0/5fpl1WIg3ETY6u1oWprZKBf8c7dvHNq/ly4mSyvrCBHfp8eOHh2fnKqurr566WpNTW1zd/v56xcbG+oOnDpY6M8FObo4uxQ4JbeQVTl8N1AzK1PMJzbSLE1jXCoyNspsy5AaXstnBg7tbWlrLTOHGnxpalVqUuqgRB0tZJGwhR1pBAgGUGHZTbNtW9ed+cV7+TxMRJ5+9mQohDWH1lfFNYai2/YeK8gv/vWXKYNr+aITshlRadkP/vCHNCumeA23+DP/Lo9CpZ2qskbD26SmxrDySYSgFGl4cXb2lz7xCVou6zwwKG20wh1VMUv1Qzt6lWVX245wNpKb7S39uVwwfHuK++zU/v1avlC8N2kJ2drWNrs0u+/oPhS1rNrEzPJMfV11xNLLuexmMtvU0ReJxE2i60yWVtPJlQ2XBYwx4QXCp+m1DQlB72B/S3enFTb1aHjDya9srG0srVQnYpubmzv37KScWaEIdYLhi8MnDx9/6Wsv6IFyD5ipDxw+9K1bV7Ocu0LuO7b34PEhyJ0YMufHpkZvjvX2DBw+efrMK6+/fvEqx2bZNEoc/MzP/uKjT79bOa8aqTAEvwOb7juzBWyVmiurYWhAyMbGxl/6pV/+D7/zO9InAPG069kF0RyWBpFBMejfvrOxr/WbL3x9aLAHYtNIVF26dP38nRs7mtp6du4oLi3fn180iTZ6/XZTZ/O2xvqF6fn6upr5+cXxkZHDR4+P3h9TOSxOhUNDghzYs7dUcmzTcnOFloamS6+dTyaTnCAq6bUrI639PWevXzp05PDK6lJvZ8e9u/e8cnBr7GYoFGquaTQN7cKl80JDLmctXZ2eZT5340pSBs09nQf37rp1+9rNYceAMq6FsstJExrzUwsTc/99emXDR4TrWpmJQ8dPn3rkEYCJKuR/9+1vs6A8YCraiuVVM7RKimmmObR71wc++EFPgIJiP+bThZVlv5SjMhSq3v/EDza07fZQrMg414Ld+9p+6EeeDMftuysL55Zm7KHBut4+AQ3m8sJGeuTVCzYjM/cXMxkvHm5w095Q60AMmYd3HxjctW3n0Z0gLEfn72hhMjo9nswkl5KrHILp6VmCjNRaOmZFBge2N9XWA8ozyU2oYcfzhM/3De68dO5camU5tbkuNNhz/OAipF8bHVkhYuDgrqefeaSh2e7vbehub9u/+3BmM++WAhRgzMjywkbAoA9wSci6jrYPf/xjmuJhrHj7W6tTvNP2zrr2gH8BIc4E1gAPuGZZT7/n2eRG5pWXnmeEIWmulR0Atd7a1uTo7Lkb13iRcY8ywhmESwvTLU21pK1z5M7dl29e6w7VDu7dXV5fTK+viYKLbaNvV5dmaJ0Ha29cvmQjgxed6xcvVtfXzJfyrS0toVDkwtXLoUhYkasLYdqGV3Zym+n9u/fG7PDK3AJ3vYgRWp5bHujdfvXS9fb6houvXN61c//s4lJLR3vG887euZUOfLMhvmPXzqOHDmjAw5wjxiLQ7t13nBf4mefP6AJvZrKBxMDQAy6rGps+8cu/Ul1TJ4AQnCFIlFv2Xfhdv81a9/YdKn2QalmaLb9ElWYVOBSAQPynf//bl6+8AWjRRn4IkLZEq81g1ERAuNgMtKguLb3guP29Ax2dffdnl86+cSmbK2LKD/b1dlbXLY7ed/I5lTSAbNtAdyGXbm9rm5ycaKyvnZic1kORnbv3jVy/dvrhh6pqa1ZnZkdevUgUoFXjCDR1ddhVsdm11UKhsK27d3lhuUxl4DPocTscqulsxdXx83dvrxfzum30DPS0tTcuzs0eOri/OhaTvnv72k13vXz0+Onmgf4//NSn0smc6rhGkGo6Cof/1a/86tD+/WrRFwUZRJQz1alZWS/k785r7yy1LcGpwlJlLZUtB09R3QeiVMz/7u/+h/G7I5AXse/FSLjOsFtCVghxxkudO/pP/vOPfOtLX7AxaGxsZFArUfnCa28sLSyDkhPXrbZoXUd9E+Qsub6UzqxaOtIVYYC/rbtrbm7BClfX1NaNjo7WNdYjQ+tuaZm4dN1Q1IkcEMwwEETFyPliEQDgBJSE4g1NrfWR2mQuM1tIr+TTAUHt27r2HNxVXxOFbnn4ytWq+ubNjQ2dMVgKYEkiYq2DYL1YzBfdABJgh7imf+KXf2XP/oNANyspxkrT8YP4SZXy/z6pvaPsKt/8NpuupAwSPZfN/8F//o+3Lp9TvBfM1zmr1fTOqkSIB//sQz8c2b/7c1/8SzPI7R7sL/rlshNcuXyzvbMvlc7euz9dzLqIo/pIdHtvd1jHTnpTZkp+NoN9HyjQPjYMk/mBphlMCouYIFDs0wyolngEgOqEIkC1GUXDVm11QTM2c87c1LzLOa6KRGLhGARPvOu0jDHL1pzN/J07kz/+679TXFj+7O/+R9Ojuk8cyqecfAHIQKIAaaHa+g//9L84/tBjlWVovr1+BK+wweDvwlv3fTJaa6oXJl4V++i/+NhXotFXX3oeE+Xb5ziaWk9tq62jFH/uT/9sfn2+VhdjrrdZ2KxvbK4N2X1tjdsHe3fu2zW7sHr96kg6Xbwwcg0jEDfMejPW0tEf1VDMMlSTBBfFYplzqZgCOBC+ilWhoUkE46EIl8yHqkVlqZBJpTcLCJUYi8Yi+/fvqu1oioVCE69fnhq/07WvUxDOymUnl5u5ONzdPxiLVfs8l8oUkoViUYNMNziAoWji47/wi9t376/g4Csh5fe2RNo7s3G+4yQogGBqLTJpAB1Q7uQLf/HZPz939mXAfJ1xk/EE1sIaaGwMAVrSuard7jt2ePfT7/r6n/+3jr4OHDGhRvwyu/DGpa72rtRmZmE9mS+UHQdIKqFXiul6LGSHbFOzTA2rGNPUVKONx2ie+iXqUScolpwSpZppGIapW0ZVfTXj7tFDu5rbal3oYQFGzt4Y6O4fnbqnEYE8t5QuYa1q74Hjs6tLl4avlUsBNhXVKUO4o73noz/38bYdQyoGePs6VaoiUGHu3uLt+IfrmlAreWDBKcKanaj+6Z/9eE9/35988o8AYQCgHMMlt0h5oS5iGnpIA6C/awjAEHLE2tRCz2BvLpsZuTlmYTTU1+n3tB5AZCNTunDpNiG67xWdQnbDKfuplOoWEJRARD3XxpqAoAw5sW0pYE1HPQn43v37a2vrE4kYEPTKpXOFXLq5IYpguVR0nFLxwOlHD5x89NN/9Aew5GqCcIeeeeHMfC7DdEvaEQVZwKS9s+tf/dKvxNvbASFMyspSbG+TWoVx+O9ZKe27eB7v9CYCSAeGBPzBygaq91t/+Ol3Revi/+1Tn8yubqiiOrZWQbBZ8BpsmAhZqcAZ+ZNPZVaTlkaGl7KBhj/8sZ+9cOn17GYynghB4pugGGW5I4ePxduryoFbLgXXLw5HidHa2hwomLAsrCQ31lb2njhCbNOKhH3Xu3L2tbYaHK+HEpQwRLGwYUPz+hs36tqr8pk8L7LFm/fbjp6EIIYEK5cL6042GwiuRwJJfEULbT3+xJM//rGPAaKA8n6FufvNdcHeREBW/qgo2jvL5/vQta1DS6lytipeAYqvnTNx6PDhrp7OP/7DPxg5fzVsGa7PbN1eKXlZx//MX38phGGDZjFX4Q53Hz1KapprqxtunT/z8EOH5yank5nCtp6ucj4b9TWCRMzWMQhqE9UtzfUirHoANOpnNlerI2FsaxwLqIGQiSfGb++LHLDM0NL8QgjhRz/wo/NXh7/5zb/WINKF9cLXn+9bywikL66mfEYLyCir1bAg1LX6+uaf/tjHhvbuVZhiDatemErzeiWrWIk7K/nsrRkK/mOub8ArMa3gmopsFZ+wFCIer/p/f+23Xn7+uW9+9av5+VlN6BBZVPBCphzTMMWlOtMKESMolsXS+vAbl1m+dO75V0qU/tBPfCTa1P3nf/7Z+sYaSb3FualDA7tWV1c9LwjHQhRAJ1/auW3H0sRMT1+vROD+6Nh73vN+3/W+9Y0Xupua1xaWolW1wBWaHTeoYVZW3/OC8isvP1/mgkEQEMuDhmp6DqF9Bw+9+wMfbOvqfcDurawkhwJoCFVq6MqK0kokpXRvyzh8X7HBdxWZVPV5NeIVBS+rODfKndliv3vXM88+8sTjn/rkH33rG8/FzIgXBCoPEARCBJlMLm6EcfXm8Kc/DQW1kAmE9ArlqJ0Ahl0qFK+evYA4ra1pOPTM+9ZGrn3zxRf6tw3cvzd+aM+BXU8+df6/f/7GheuappWKpYaaZhSJVL10eWlqSXp+hmY++yd/euDAIS71guslsxslxnzdKEsgdAvotkthVVXNL37iZ7bt2yOQJlQ180HpRMFHUIVGSzG2v+02/3FXJ3xzjTxQQTh827sRlVWdJOBEtz72f37i1MNPPP/ccyPXrhULGWSYBYp1Q88xOj86GgpbIYKrMIhbRihWvTK3cP2557FTwEIAxt2cC3yRy5SBD6evjOlSBDkfIEsyVEqXDaDacV/+6rcef9cTtESJSqOJsueWFhf+anbB8wLHpYEwpaF5QiJT0To3NTY/9u5nTp1+yK6OAy7Qm/nFrTXkKjBFtaLG1pBUWvbWh5VfW/QGW6/eWt5F9el8X1J7sH4E/DuyJwrwotroiepl3LF7T1df//rG6mc+/en7d+8EHgtpVqBiFUCpKDpumYskkJGQ8eVvvBhIGjaNyqJDmAFSnpq/MnzD9ZjlQ0M3743PHEjmF5eSXBCEDcbpxL0Zj34rlc75nlf0S45ayFCjQHdUD4FNwiEmVJ9bPJF48t1PP/medxvxxFbWv6Jl32WlkW+vcPgdmwLFV4S1tdjX1t+/9Vu/9f2u4vV3JFjZGGMVsJT2djZexljZLc1Nz9w4f3H40sVUKqkpFqxK9tf3DdXLRjy/hHVSofbSdA0HlNbU1xU8R9H/qO5iwRCqb2pcW1tTCEMnEFA4leY/SLmu62XfIYaqTwliAM0uuL4dTfRt3/bII49s3zEYa2xQ1RGiSuOqDVJVTf4Xl/h9EFNW7k5pxj+K1OSbknqwLNpWd84Wwhmo5rlyPnvl0qUzZ84szc2KwA9BhZj23bKmYa5WFAC2pnlO2dCw6rjCKHA9UzegWuZWHRAhBYVUdSCsEIMqeYX1crmsYK0SQN1kAFvRqqMnTz/yxOMtCslS4atSpd/KIqxq2lXf/n5lphpaK62jW+N0675+4Ad+4B8ite+2VQo3FfZ1URkRlWcEAKfUD9Lp9PTEvZtXh2emptZWltU18QAroyyNSqs6dZ0t+n5FxYkrQKdK+ZYQUuk8Ar7rVc6hQMGxWKy9p2fn7n39gzub2jqsWLzinm6ddmsxjEqjkGoTUajdty8F+L1sb19MTmHuiGosZ4z9o0lNbpW8Ku2mD5KalcV8mVQUjEIyDat0FfN9oiIYwT0/k07fuXNrcnJ6dXU5nc465YLvFrHkUsXoAdTVsgYEwMo6ygRrxOU0Go3WJ2rr62sbW9sGh3Z0d/Vq4QggqmtCKlNRMX8PlmPbGgqCVxpxthZS/F8Yn2+Nni3x+b6vOCX+UaQm3zzo31rpr3JKNaLUBM24mvi2zqYscEUffA9phlcuun5QKOQC32GBFxQ9JiurdKsmD2iZJoRQNwwjGgqHwxbSbduCpqGO8KC4+6CG+7Ypo7IM81ajy5biqWSj0L4jdPqetq3+DJVhrFAebzEO//+FDAsFYS3LrgAAAABJRU5ErkJggg==";

/**
 * Generates Class 9-10 individual BSEB Statement of Marks HTML.
 */
const generateJuniorReportCardHtml = (res, examName, academicYear, activeClassVal, logoB64) => {
    const classNumeral = activeClassVal === 9 ? 'IX' : 'X';
    
    // Today's date in DD/MM/YYYY format
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    const issueDate = `${dd}/${mm}/${yyyy}`;

    const getSub = (subId) => (res.subjectDetails || []).find(s => String(s.subjectId) === String(subId)) || {};
    const l1 = getSub(res.language1);
    const l2 = getSub(res.language2);
    const mat = getSub(`${activeClassVal}_MAT`);
    const sci = getSub(`${activeClassVal}_SCI`);
    const ssc = getSub(`${activeClassVal}_SST`);
    const eng = getSub(`${activeClassVal}_ENG`);

    const getFullMarks = (subObj) => {
        if (!subObj || Object.keys(subObj).length === 0) return 100;
        const total = (subObj.tMax || 0) + (subObj.pMax || 0);
        return total > 0 ? total : 100;
    };

    const getPassMarks = (subObj) => {
        if (!subObj || Object.keys(subObj).length === 0) return 30;
        if (subObj.passMarks) return subObj.passMarks;
        return Math.round(getFullMarks(subObj) * 0.3);
    };

    const getScoreVal = (subId) => {
        const obj = res.subjectScores[subId];
        if (!obj) return "";
        return obj.totalObt !== undefined ? obj.totalObt : "";
    };

    const l1Full = getFullMarks(l1), l1Pass = getPassMarks(l1);
    const l2Full = getFullMarks(l2), l2Pass = getPassMarks(l2);
    const matFull = getFullMarks(mat), matPass = getPassMarks(mat);
    const sciFull = getFullMarks(sci), sciPass = getPassMarks(sci);
    const sscFull = getFullMarks(ssc), sscPass = getPassMarks(ssc);
    const engFull = getFullMarks(eng), engPass = getPassMarks(eng);

    const totalFullMarks = l1Full + l2Full + matFull + sciFull + sscFull;
    const totalPassMarks = l1Pass + l2Pass + matPass + sciPass + sscPass;

    const watermarkSvg = `data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPSc0MDAnIGhlaWdodD0nMjUwJyB2aWV3Qm94PScwIDAgNDAwIDI1MCc+PHRleHQgeD0nNTAlJyB5PSc1MCUnIHRyYW5zZm9ybT0ncm90YXRlKC0yNSwgMjAwLCAxMjUpJyB0ZXh0LWFuY2hvcj0nbWlkZGxlJyBmb250LWZhbWlseT0nQXJpYWwsIHNhbnMtc2VyaWYnIGZvbnQtc2l6ZT0nMjQnIGZvbnQtd2VpZ2h0PSdib2xkJyBmaWxsPSdyZ2JhKDAsMCwwLDAuMDYpJz7gpIku4KSu4KS+LuCkteCkvy4g4KSV4KSq4KSw4KSq4KWB4KSw4KS+LCDgpJXgpL7gpIHgpJ/gpYAsIOCkruClgeCknOCkq+CljeCkq+CksOCkquClgeCksDwvdGV4dD48L3N2Zz4=`;

    return `
    <div class="bseb-report-card-page" style="width: 210mm; min-height: 297mm; padding: 12mm 15mm; margin: 0 auto; background: #fff url('${watermarkSvg}') repeat; background-size: 400px 250px; box-sizing: border-box; font-family: Arial, sans-serif; color: #000; page-break-after: always; position: relative; overflow: hidden;">
        <!-- Watermark Emblem -->
        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 400px; height: 400px; opacity: 0.08; pointer-events: none; z-index: 0;">
            <img src="${logoB64}" style="width: 100%; height: 100%; object-fit: contain;">
        </div>

        <!-- Content Area -->
        <div style="position: relative; z-index: 1;">
            <!-- Header Container -->
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px;">
                <div style="width: 100px; text-align: left;">
                    <img src="${logoB64}" style="width: 90px; height: 90px; object-fit: contain;">
                </div>
                <div style="flex: 1; text-align: center; padding: 0 10px;">
                    <h1 style="font-size: 22px; font-weight: 600; margin: 0; color: #000; letter-spacing: 0.5px;">Bihar School Examination Board, Patna</h1>
                    <h2 style="font-size: 21px; font-weight: 600; margin: 5px 0; color: #000;">बिहार विद्यालय परीक्षा समिति , पटना</h2>
                    <div style="font-size: 15px; font-weight: bold; margin-top: 8px; color: #000; letter-spacing: 0.3px;">विद्यालय: U.H.S. KAPARPURA, KANTI, MUZAFFARPUR</div>
                    <div style="font-size: 14px; font-weight: bold; margin-top: 5px; text-transform: uppercase; color: #000;">${examName} STATEMENT OF MARKS</div>
                    <div style="font-size: 14px; font-weight: bold; color: #000; margin-top: 2px;">CLASS ${classNumeral}</div>
                </div>
                <div style="width: 100px;"></div>
            </div>

            <hr style="border: none; border-top: 1.5px solid #000; margin: 0 0 15px 0;">

            <!-- Student Details Grid -->
            <div style="display: flex; justify-content: space-between; font-size: 14px; line-height: 1.6; margin-bottom: 15px; color: #000;">
                <div>
                    <div>नाम Name: &nbsp;&nbsp;&nbsp; <span style="text-transform: uppercase;">${res.studentName}</span></div>
                    <div>पिता का नाम Father's Name: &nbsp;&nbsp;&nbsp; <span style="text-transform: uppercase;">${res.fatherName || '-'}</span></div>
                    <div>माता का नाम Mother's Name: &nbsp;&nbsp;&nbsp; <span style="text-transform: uppercase;">${res.motherName || '-'}</span></div>
                    <div>रोल न. Roll No.: &nbsp;&nbsp;&nbsp; <span>${res.rollNo}</span></div>
                </div>
                <div style="text-align: right;">
                    <div style="display: flex; justify-content: space-between; width: 220px;">
                        <span>UDISE CODE:</span> <span style="font-weight: bold;">10140616812</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; width: 220px;">
                        <span>BSEB CODE:</span> <span style="font-weight: bold;">51375</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; width: 220px;">
                        <span>सत्र Session:</span> <span style="font-weight: bold;">${academicYear}</span>
                    </div>
                </div>
            </div>

            <!-- Marks Table -->
            <table style="width: 100%; border-collapse: collapse; text-align: center; font-size: 13px; margin-bottom: 25px; border: 1.5px solid #000;" border="1">
                <thead>
                    <tr style="background: #EAEAEA; font-weight: bold; color: #000; height: 45px;">
                        <th style="border: 1px solid #000; padding: 8px; width: 14%;">SUB.<br>CODE</th>
                        <th style="border: 1px solid #000; padding: 8px; width: 36%;">SUBJECT</th>
                        <th style="border: 1px solid #000; padding: 8px; width: 16%;">FULL MARKS</th>
                        <th style="border: 1px solid #000; padding: 8px; width: 16%;">PASS MARKS</th>
                        <th style="border: 1px solid #000; padding: 8px; width: 18%;">MARKS OBTAINED</th>
                    </tr>
                </thead>
                <tbody style="font-size: 14px;">
                    <tr style="height: 40px;">
                        <td style="border: 1px solid #000; padding: 6px;">${l1.code || '101'}</td>
                        <td style="border: 1px solid #000; padding: 6px 15px; text-align: left; text-transform: uppercase;">${l1.name || 'HINDI'}</td>
                        <td style="border: 1px solid #000; padding: 6px;">${l1Full}</td>
                        <td style="border: 1px solid #000; padding: 6px;">${l1Pass}</td>
                        <td style="border: 1px solid #000; padding: 6px;">${getScoreVal(res.language1)}</td>
                    </tr>
                    <tr style="height: 40px;">
                        <td style="border: 1px solid #000; padding: 6px;">${l2.code || '105/103'}</td>
                        <td style="border: 1px solid #000; padding: 6px 15px; text-align: left; text-transform: uppercase;">${l2.name || 'SANSKRIT/URDU'}</td>
                        <td style="border: 1px solid #000; padding: 6px;">${l2Full}</td>
                        <td style="border: 1px solid #000; padding: 6px;">${l2Pass}</td>
                        <td style="border: 1px solid #000; padding: 6px;">${getScoreVal(res.language2)}</td>
                    </tr>
                    <tr style="height: 40px;">
                        <td style="border: 1px solid #000; padding: 6px;">${mat.code || '110'}</td>
                        <td style="border: 1px solid #000; padding: 6px 15px; text-align: left; text-transform: uppercase;">${mat.name || 'MATHEMATICS'}</td>
                        <td style="border: 1px solid #000; padding: 6px;">${matFull}</td>
                        <td style="border: 1px solid #000; padding: 6px;">${matPass}</td>
                        <td style="border: 1px solid #000; padding: 6px;">${getScoreVal(`${activeClassVal}_MAT`)}</td>
                    </tr>
                    <tr style="height: 40px;">
                        <td style="border: 1px solid #000; padding: 6px;">${sci.code || '112'}</td>
                        <td style="border: 1px solid #000; padding: 6px 15px; text-align: left; text-transform: uppercase;">${sci.name || 'SCIENCE'}</td>
                        <td style="border: 1px solid #000; padding: 6px;">${sciFull}</td>
                        <td style="border: 1px solid #000; padding: 6px;">${sciPass}</td>
                        <td style="border: 1px solid #000; padding: 6px;">${getScoreVal(`${activeClassVal}_SCI`)}</td>
                    </tr>
                    <tr style="height: 40px;">
                        <td style="border: 1px solid #000; padding: 6px;">${ssc.code || '111'}</td>
                        <td style="border: 1px solid #000; padding: 6px 15px; text-align: left; text-transform: uppercase;">${ssc.name || 'SOCIAL SCIENCE'}</td>
                        <td style="border: 1px solid #000; padding: 6px;">${sscFull}</td>
                        <td style="border: 1px solid #000; padding: 6px;">${sscPass}</td>
                        <td style="border: 1px solid #000; padding: 6px;">${getScoreVal(`${activeClassVal}_SST`)}</td>
                    </tr>
                    <tr style="height: 45px; font-weight: bold;">
                        <td style="border: 1px solid #000; padding: 6px;" colspan="2">TOTAL</td>
                        <td style="border: 1px solid #000; padding: 6px;">${totalFullMarks}</td>
                        <td style="border: 1px solid #000; padding: 6px;">${totalPassMarks}</td>
                        <td style="border: 1px solid #000; padding: 6px; font-size: 15px;">${res.grandTotal !== undefined && res.grandTotal !== '' ? res.grandTotal : ''}</td>
                    </tr>
                    <tr style="height: 40px;">
                        <td style="border: 1px solid #000; padding: 6px;">${eng.code || '113'}</td>
                        <td style="border: 1px solid #000; padding: 6px 15px; text-align: left; text-transform: uppercase;">${eng.name || 'ENGLISH'}</td>
                        <td style="border: 1px solid #000; padding: 6px;">${engFull}</td>
                        <td style="border: 1px solid #000; padding: 6px;">${engPass}</td>
                        <td style="border: 1px solid #000; padding: 6px;">${getScoreVal(`${activeClassVal}_ENG`)}</td>
                    </tr>
                </tbody>
            </table>

            <!-- Result Metrics & Summary -->
            <div style="display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 50px; padding: 0 5px; color: #000;">
                <div style="line-height: 1.8;">
                    <div>PLACE: MUZAFFARPUR</div>
                    <div style="margin-top: 5px;">ISSUE DATE: ${issueDate}</div>
                </div>
                <div style="width: 250px; line-height: 1.8;">
                    <div style="display: flex; justify-content: space-between;"><span>RANK</span> <span style="font-weight: bold;">${res.rank && res.rank !== '-' ? res.rank : ''}</span></div>
                    <div style="display: flex; justify-content: space-between;"><span>PERCENTAGE</span> <span style="font-weight: bold;">${res.percentage !== '0.0%' ? res.percentage : ''}</span></div>
                    <div style="display: flex; justify-content: space-between;"><span>DIVISION</span> <span style="font-weight: bold;">${res.division !== 'Incomplete' ? res.division : ''}</span></div>
                    <div style="display: flex; justify-content: space-between;"><span>RESULT</span> <span style="font-weight: bold;">${res.result !== 'Incomplete' ? res.result : ''}</span></div>
                </div>
            </div>

            <!-- Signatures -->
            <div style="display: flex; justify-content: space-between; margin-top: 80px; font-size: 14px; color: #000;">
                <div>CLASS TEACHER'S SIGNATURE</div>
                <div>PRINCIPAL'S SIGNATURE</div>
            </div>
        </div>
    </div>`;
};

/**
 * Generates Class 11-12 individual BSEB Statement of Marks HTML.
 */
const generateSeniorReportCardHtml = (res, examName, academicYear, activeClassVal, streamName, logoB64) => {
    const classNumeral = activeClassVal === 11 ? 'XI' : 'XII';
    
    // Today's date in DD/MM/YYYY format
    const today = new Date();
    const dd = String(today.getDate()).padStart(2, '0');
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const yyyy = today.getFullYear();
    const issueDate = `${dd}/${mm}/${yyyy}`;

    const getSubDetails = (subId) => {
        if (!subId) return null;
        return (res.subjectDetails || []).find(s => String(s.subjectId) === String(subId)) || null;
    };

    const getSubData = (subObj) => {
        if (!subObj) return { name: "", theoryObt: "", practicalObt: "", totalObt: "", score: "", tMax: 100, pMax: 0, fullMarks: 100, passMarks: 30 };
        const scoreObj = res.subjectScores[subObj.subjectId];
        const tMax = subObj.tMax || 100;
        const pMax = subObj.pMax || 0;
        const fullMarks = tMax + pMax;
        const passMarks = subObj.passMarks || Math.round(fullMarks * 0.3);
        return {
            name: subObj.name,
            theoryObt: scoreObj ? scoreObj.theoryObt : "",
            practicalObt: scoreObj ? scoreObj.practicalObt : "",
            totalObt: scoreObj ? scoreObj.totalObt : "",
            pMax: pMax,
            fullMarks: fullMarks,
            passMarks: passMarks
        };
    };

    const sdL1 = getSubData(getSubDetails(res.language1));
    const sdL2 = getSubData(getSubDetails(res.language2));
    const sdE1 = getSubData(getSubDetails(res.elective1));
    const sdE2 = getSubData(getSubDetails(res.elective2));
    const sdE3 = getSubData(getSubDetails(res.elective3));
    const sdAdd = getSubData(getSubDetails(res.additional));

    const renderSubRow = (sd) => {
        if (!sd.name) return "";
        return `
        <tr style="height: 36px;">
            <td style="border: 1px solid #000; padding: 6px 15px; text-align: left; text-transform: uppercase;">${sd.name}</td>
            <td style="border: 1px solid #000; padding: 6px;">${sd.fullMarks}</td>
            <td style="border: 1px solid #000; padding: 6px;">${sd.passMarks}</td>
            <td style="border: 1px solid #000; padding: 6px;">${sd.theoryObt}</td>
            <td style="border: 1px solid #000; padding: 6px;">${sd.pMax > 0 ? sd.practicalObt : ''}</td>
            <td style="border: 1px solid #000; padding: 6px;">${sd.totalObt}</td>
        </tr>`;
    };

    const watermarkSvg = `data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPSc0MDAnIGhlaWdodD0nMjUwJyB2aWV3Qm94PScwIDAgNDAwIDI1MCc+PHRleHQgeD0nNTAlJyB5PSc1MCUnIHRyYW5zZm9ybT0ncm90YXRlKC0yNSwgMjAwLCAxMjUpJyB0ZXh0LWFuY2hvcj0nbWlkZGxlJyBmb250LWZhbWlseT0nQXJpYWwsIHNhbnMtc2VyaWYnIGZvbnQtc2l6ZT0nMjQnIGZvbnQtd2VpZ2h0PSdib2xkJyBmaWxsPSdyZ2JhKDAsMCwwLDAuMDYpJz7gpIku4KSu4KS+LuCkteCkvy4g4KSV4KSq4KSw4KSq4KWB4KSw4KS+LCDgpJXgpL7gpIHgpJ/gpYAsIOCkruClgeCknOCkq+CljeCkq+CksOCkquClgeCksDwvdGV4dD48L3N2Zz4=`;

    return `
    <div class="bseb-report-card-page" style="width: 210mm; min-height: 297mm; padding: 12mm 15mm; margin: 0 auto; background: #fff url('${watermarkSvg}') repeat; background-size: 400px 250px; box-sizing: border-box; font-family: Arial, sans-serif; color: #000; page-break-after: always; position: relative; overflow: hidden;">
        <!-- Watermark Emblem -->
        <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 400px; height: 400px; opacity: 0.08; pointer-events: none; z-index: 0;">
            <img src="${logoB64}" style="width: 100%; height: 100%; object-fit: contain;">
        </div>

        <!-- Content Area -->
        <div style="position: relative; z-index: 1;">
            <!-- Header Container -->
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px;">
                <div style="width: 100px; text-align: left;">
                    <img src="${logoB64}" style="width: 90px; height: 90px; object-fit: contain;">
                </div>
                <div style="flex: 1; text-align: center; padding: 0 10px;">
                    <h1 style="font-size: 22px; font-weight: 600; margin: 0; color: #000; letter-spacing: 0.5px;">Bihar School Examination Board, Patna</h1>
                    <h2 style="font-size: 21px; font-weight: 600; margin: 5px 0; color: #000;">बिहार विद्यालय परीक्षा समिति , पटना</h2>
                    <div style="font-size: 15px; font-weight: bold; margin-top: 8px; color: #000; letter-spacing: 0.3px;">विद्यालय: U.H.S. KAPARPURA, KANTI, MUZAFFARPUR</div>
                    <div style="font-size: 14px; font-weight: bold; margin-top: 5px; text-transform: uppercase; color: #000;">${examName} STATEMENT OF MARKS</div>
                    <div style="font-size: 14px; font-weight: bold; color: #000; margin-top: 2px;">CLASS ${classNumeral}</div>
                </div>
                <div style="width: 100px;"></div>
            </div>

            <hr style="border: none; border-top: 1.5px solid #000; margin: 0 0 15px 0;">

            <!-- Student Details Grid -->
            <div style="display: flex; justify-content: space-between; font-size: 14px; line-height: 1.6; margin-bottom: 15px; color: #000;">
                <div>
                    <div>नाम Name: &nbsp;&nbsp;&nbsp; <span style="text-transform: uppercase;">${res.studentName}</span></div>
                    <div>पिता का नाम Father's Name: &nbsp;&nbsp;&nbsp; <span style="text-transform: uppercase;">${res.fatherName || '-'}</span></div>
                    <div>माता का नाम Mother's Name: &nbsp;&nbsp;&nbsp; <span style="text-transform: uppercase;">${res.motherName || '-'}</span></div>
                    <div>रोल न. Roll No.: &nbsp;&nbsp;&nbsp; <span>${res.rollNo}</span></div>
                </div>
                <div style="text-align: right;">
                    <div style="display: flex; justify-content: space-between; width: 220px;">
                        <span>UDISE CODE:</span> <span style="font-weight: bold;">10140616812</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; width: 220px;">
                        <span>सत्र Session:</span> <span style="font-weight: bold;">${academicYear}</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; width: 220px;">
                        <span>INTER CODE:</span> <span style="font-weight: bold;">31445</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; width: 220px;">
                        <span>FACULTY:</span> <span style="font-weight: bold; text-transform: uppercase;">${streamName || 'ARTS'}</span>
                    </div>
                </div>
            </div>

            <!-- Marks Table -->
            <table style="width: 100%; border-collapse: collapse; text-align: center; font-size: 13px; margin-bottom: 25px; border: 1.5px solid #000;" border="1">
                <thead>
                    <tr style="background: #EAEAEA; font-weight: bold; color: #000;">
                        <th rowspan="2" style="border: 1px solid #000; padding: 6px; width: 35%;">SUBJECT</th>
                        <th rowspan="2" style="border: 1px solid #000; padding: 6px; width: 12%;">FULL<br>MARKS</th>
                        <th rowspan="2" style="border: 1px solid #000; padding: 6px; width: 12%;">PASS<br>MARKS</th>
                        <th colspan="2" style="border: 1px solid #000; padding: 6px; width: 25%;">MARKS OBTAINED</th>
                        <th rowspan="2" style="border: 1px solid #000; padding: 6px; width: 16%;">SUBJECT<br>TOTAL</th>
                    </tr>
                    <tr style="background: #EAEAEA; font-weight: bold; color: #000;">
                        <th style="border: 1px solid #000; padding: 4px;">THEORY</th>
                        <th style="border: 1px solid #000; padding: 4px;">PRACTICAL</th>
                    </tr>
                </thead>
                <tbody style="font-size: 14px;">
                    <!-- 1. Compulsory -->
                    <tr style="background: #F4F4F4;">
                        <td colspan="6" style="border: 1px solid #000; padding: 6px 15px; text-align: left; font-weight: bold;">1. अनिवार्य (Compulsory)</td>
                    </tr>
                    ${renderSubRow(sdL1)}
                    ${renderSubRow(sdL2)}

                    <!-- 2. Elective -->
                    <tr style="background: #F4F4F4;">
                        <td colspan="6" style="border: 1px solid #000; padding: 6px 15px; text-align: left; font-weight: bold;">2. ऐच्छिक (Elective)</td>
                    </tr>
                    ${renderSubRow(sdE1)}
                    ${renderSubRow(sdE2)}
                    ${renderSubRow(sdE3)}

                    <!-- 3. Additional (if present) -->
                    ${sdAdd.name ? `
                    <tr style="background: #F4F4F4;">
                        <td colspan="6" style="border: 1px solid #000; padding: 6px 15px; text-align: left; font-weight: bold;">3. अतिरिक्त (Additional)</td>
                    </tr>
                    ${renderSubRow(sdAdd)}
                    ` : ''}

                    <!-- Final Result Section -->
                    <tr style="background: #F4F4F4;">
                        <td colspan="6" style="border: 1px solid #000; padding: 6px 15px; text-align: left; font-weight: bold;">FINAL RESULT</td>
                    </tr>
                    <tr style="height: 36px;">
                        <td colspan="2" style="border: 1px solid #000; padding: 6px 15px; font-weight: bold; text-align: left;">AGGREGATE MARKS :</td>
                        <td colspan="4" style="border: 1px solid #000; padding: 6px 15px; font-weight: bold; text-align: left;">${res.grandTotal !== undefined && res.grandTotal !== '' ? res.grandTotal : ''}</td>
                    </tr>
                    <tr style="height: 36px;">
                        <td colspan="2" style="border: 1px solid #000; padding: 6px 15px; font-weight: bold; text-align: left;">RESULT / DIVISION :</td>
                        <td colspan="4" style="border: 1px solid #000; padding: 6px 15px; font-weight: bold; text-align: left;">${res.result !== 'Incomplete' ? res.result : ''} &nbsp; / &nbsp; ${res.division !== 'Incomplete' ? res.division : ''}</td>
                    </tr>
                    <tr style="height: 36px;">
                        <td colspan="2" style="border: 1px solid #000; padding: 6px 15px; font-weight: bold; text-align: left;">PERCENTAGE :</td>
                        <td colspan="4" style="border: 1px solid #000; padding: 6px 15px; font-weight: bold; text-align: left;">${res.percentage !== '0.0%' ? res.percentage : ''}</td>
                    </tr>
                </tbody>
            </table>

            <!-- Result Metrics & Summary -->
            <div style="display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 50px; padding: 0 5px; color: #000;">
                <div style="line-height: 1.8;">
                    <div>PLACE: MUZAFFARPUR</div>
                    <div style="margin-top: 5px;">ISSUE DATE: ${issueDate}</div>
                </div>
            </div>

            <!-- Signatures -->
            <div style="display: flex; justify-content: space-between; margin-top: 80px; font-size: 14px; color: #000;">
                <div>CLASS TEACHER'S SIGNATURE</div>
                <div>PRINCIPAL'S SIGNATURE</div>
            </div>
        </div>
    </div>`;
};

/**
 * Opens a dedicated popup print window containing the report card HTML.
 */
const openPrintWindow = (htmlContent, documentTitle) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        showToast("Pop-up blocker prevented opening the print window. Please allow pop-ups.", "error");
        return;
    }

    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>${documentTitle}</title>
            <meta charset="utf-8">
            <style>
                @page { size: A4 portrait; margin: 0; }
                body { margin: 0; padding: 0; background: #fff; font-family: 'Times New Roman', Times, serif; }
                * { box-sizing: border-box; }
                @media print { .bseb-report-card-page { page-break-after: always; } }
            </style>
        </head>
        <body>
            ${htmlContent}
            <script>
                window.onload = function() {
                    window.print();
                    setTimeout(function() { window.close(); }, 500);
                };
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
};

/**
 * Print individual report card for a single student.
 */
const handlePrintSingleReportCard = (studentId) => {
    const activeData = currentResults.find(r => r.classVal === activeClassVal);
    if (!activeData) return;

    const student = activeData.studentResults.find(s => String(s.studentId) === String(studentId));
    if (!student) return;

    const yearSelect = document.querySelector("#filter-academic-year");
    const examSelect = document.querySelector("#filter-exam");
    const streamSelect = document.querySelector("#filter-stream");

    const year = yearSelect ? yearSelect.value : "";
    const examName = examSelect ? examSelect.value : "";
    const streamName = streamSelect ? streamSelect.value : "ARTS";

    const isSenior = (activeClassVal === 11 || activeClassVal === 12);
    const cardHtml = isSenior
        ? generateSeniorReportCardHtml(student, examName, year, activeClassVal, streamName, BSEB_LOGO_B64)
        : generateJuniorReportCardHtml(student, examName, year, activeClassVal, BSEB_LOGO_B64);

    openPrintWindow(cardHtml, `ReportCard_${student.rollNo}_${student.studentName}`);
};

/**
 * Batch print all report cards for current class selection.
 */
const handlePrintAllReportCards = () => {
    const activeData = currentResults.find(r => r.classVal === activeClassVal);
    if (!activeData || !activeData.studentResults || !activeData.studentResults.length) {
        showToast("No student results available to print.", "error");
        return;
    }

    const yearSelect = document.querySelector("#filter-academic-year");
    const examSelect = document.querySelector("#filter-exam");
    const streamSelect = document.querySelector("#filter-stream");

    const year = yearSelect ? yearSelect.value : "";
    const examName = examSelect ? examSelect.value : "";
    const streamName = streamSelect ? streamSelect.value : "ARTS";

    const isSenior = (activeClassVal === 11 || activeClassVal === 12);

    let allCardsHtml = "";
    activeData.studentResults.forEach(student => {
        const cardHtml = isSenior
            ? generateSeniorReportCardHtml(student, examName, year, activeClassVal, streamName, BSEB_LOGO_B64)
            : generateJuniorReportCardHtml(student, examName, year, activeClassVal, BSEB_LOGO_B64);
        allCardsHtml += cardHtml;
    });

    openPrintWindow(allCardsHtml, `All_ReportCards_Class_${activeClassVal}_${examName}`);
};


const getDefaultAcademicYear = () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const startYear = (currentMonth < 3) ? currentYear - 1 : currentYear;
    return `${startYear}-${String(startYear + 1).slice(-2)}`;
};

const getAcademicYears = () => {
    const current = getDefaultAcademicYear();
    const startYear = parseInt(current.split("-")[0], 10);
    const next = `${startYear + 1}-${String(startYear + 2).slice(-2)}`;
    return [current, next];
};

/**
 * Returns an array of currently checked class numbers.
 */
const getCheckedClasses = () => {
    return Array.from(document.querySelectorAll('input[name="classes"]:checked')).map(el => el.value);
};

/**
 * Checks and updates the visibility of the Stream filter.
 */
const updateStreamFilterVisibility = () => {
    const streamContainer = document.querySelector("#stream-filter-container");
    const streamSelect = document.querySelector("#filter-stream");
    const checked = getCheckedClasses();
    
    // Show stream if Class 11 or Class 12 is checked
    const hasSrSec = checked.includes("11") || checked.includes("12");
    
    if (hasSrSec && streamContainer && streamSelect) {
        streamContainer.style.display = "flex";
        streamSelect.setAttribute("required", "required");
    } else if (streamContainer && streamSelect) {
        streamContainer.style.display = "none";
        streamSelect.removeAttribute("required");
        streamSelect.value = "";
    }
};

/**
 * Dynamically queries available sections for the selected year and the first checked class.
 */
const updateAvailableSections = async () => {
    const yearInput = document.querySelector("#filter-academic-year");
    const sectionSelect = document.querySelector("#filter-section");

    if (!yearInput || !sectionSelect) return;

    const year = String(yearInput.value || "").trim();
    const checked = getCheckedClasses();

    if (!year || checked.length === 0) {
        sectionSelect.innerHTML = '<option value="">Select Section</option>';
        return;
    }

    // Query sections using the first checked class as reference
    const classNum = checked[0];

    try {
        const response = await apiRequest(`subject.tag.getSections?academicYear=${year}&classNum=${classNum}`);
        if (response.success && response.sections) {
            sectionSelect.innerHTML = '<option value="">Select Section</option>';
            response.sections.forEach(sec => {
                sectionSelect.innerHTML += `<option value="${sec}">Section ${sec}</option>`;
            });
            
            if (response.sections.length === 0) {
                sectionSelect.innerHTML = '<option value="">No sections available</option>';
            } else {
                if (response.sections.includes("A")) {
                    sectionSelect.value = "A";
                } else {
                    sectionSelect.value = response.sections[0];
                }
            }
        }
    } catch (error) {
        console.error("Failed to load sections:", error);
    }
};

/**
 * Renders the tabs list of generated class results.
 */
const renderTabs = () => {
    const tabsContainer = document.querySelector("#results-tabs-container");
    if (!tabsContainer) return;

    tabsContainer.innerHTML = "";

    currentResults.forEach(classRes => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `class-tab${activeClassVal === classRes.classVal ? " active" : ""}`;
        btn.style.padding = "10px 20px";
        btn.style.border = "none";
        btn.style.background = "none";
        btn.style.fontWeight = activeClassVal === classRes.classVal ? "700" : "600";
        btn.style.color = activeClassVal === classRes.classVal ? "var(--color-primary)" : "var(--color-muted)";
        btn.style.borderBottom = activeClassVal === classRes.classVal ? "3px solid var(--color-primary)" : "3px solid transparent";
        btn.style.cursor = "pointer";
        btn.style.transition = "all 0.2s";
        btn.textContent = `Class ${classRes.classVal}`;

        btn.addEventListener("click", () => {
            activeClassVal = classRes.classVal;
            renderTabs();
            renderTable();
        });
        tabsContainer.appendChild(btn);
    });
};

/**
 * Helper to extract a score value from the structured subjectScores object.
 * subjectScores[subjectId] is now { displayVal, theoryObt, practicalObt, totalObt, tMax, pMax }
 */
const getScore = (subjectScores, subjectId, field = "displayVal") => {
    const obj = subjectScores[subjectId];
    if (!obj) return "";
    if (typeof obj === "string") return obj; // backward compat
    return obj[field] !== undefined ? obj[field] : "";
};

/**
 * Determines the BSEB abbreviation for a Class 9-10 subject based on its group or name.
 */
const getSubjectAbbrev910 = (sub) => {
    const g = String(sub.group || "").toLowerCase();
    if (g === "language1") return "MIL";
    if (g === "language2") return "SIL";

    const name = String(sub.name || "").toLowerCase();
    if (name.includes("math")) return "MAT";
    if (name.includes("science") && !name.includes("social")) return "SCI";
    if (name.includes("social") || name.includes("ssc") || name.includes("sst")) return "SSC";
    if (name.includes("english") || name.includes("eng")) return "ENG";
    if (name.includes("opt") && name.includes("voc")) return "OPT.SUB(VO C.)";
    if (name.includes("opt")) return "OPT SUB";

    // Fallback to code or name
    return sub.code || sub.name;
};

/**
 * Checks if ANY subject in the active list has practical marks configured > 0.
 */
const hasPracticalExam = (activeSubjects) => {
    return activeSubjects.some(sub => (sub.pMax || 0) > 0);
};

// ── Shared style constants ──
const TH = "padding: 8px 10px; font-weight: 700; color: var(--color-text); font-size: 0.85rem; line-height: 1.2;";
const TH_C = TH + " text-align: center;";
const TD = "padding: 8px 10px; font-size: 0.85rem; line-height: 1.2;";
const TD_C = TD + " text-align: center;";
const BL = "border-left: 1px solid var(--color-border);";
const BB = "border-bottom: 1px solid var(--color-border);";

/**
 * Renders the results grid table for the active class tab.
 */

/**
 * Renders touch-friendly cards view for mobile screens.
 */
const renderCardsView = (container, activeSubjects, filteredStudents) => {
    if (!container) return;
    container.innerHTML = "";

    if (filteredStudents.length === 0) {
        container.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; padding: 32px; background: #ffffff; border-radius: 12px; border: 1px solid var(--color-border); color: var(--color-muted); font-weight: 600;">No student results match your search query.</div>';
        return;
    }

    filteredStudents.forEach(stud => {
        const card = document.createElement("div");
        card.className = "mobile-student-card";
        card.style.cssText = "background: #ffffff; border: 1px solid var(--color-border); border-radius: 12px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,0.03); display: flex; flex-direction: column; gap: 12px; transition: transform 0.2s, box-shadow 0.2s;";

        let divBg = "#f1f5f9";
        let divColor = "#475569";
        const divText = String(stud.division || "Incomplete").trim();

        if (divText.includes("1st")) {
            divBg = "#dcfce7"; divColor = "#15803d";
        } else if (divText.includes("2nd")) {
            divBg = "#dbeafe"; divColor = "#1d4ed8";
        } else if (divText.includes("3rd")) {
            divBg = "#fef3c7"; divColor = "#b45309";
        } else if (divText.includes("Fail")) {
            divBg = "#fee2e2"; divColor = "#b91c1c";
        }

        let subRowsHtml = "";
        activeSubjects.forEach(sub => {
            let scoreVal = getScore(stud.subjectScores, sub.id, "displayVal");
            let totalObt = getScore(stud.subjectScores, sub.id, "totalObt");
            if (!scoreVal && totalObt !== "") scoreVal = totalObt;

            subRowsHtml += `
                <tr style="border-bottom: 1px dashed var(--color-border);">
                    <td style="padding: 6px 4px; font-weight: 600; color: var(--color-text); font-size: 0.82rem;">${sub.name}</td>
                    <td style="padding: 6px 4px; text-align: right; font-weight: 700; color: var(--color-primary); font-size: 0.85rem;">${scoreVal || '-'}</td>
                </tr>
            `;
        });

        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;">
                <div>
                    <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                        <span style="background: var(--color-primary-light, #e0e7ff); color: var(--color-primary); font-weight: 800; padding: 4px 8px; border-radius: 6px; font-size: 0.8rem;">Roll #${stud.rollNo}</span>
                        <span style="font-weight: 800; font-size: 1.05rem; color: var(--color-text);">${stud.studentName}</span>
                    </div>
                    <div style="font-size: 0.8rem; color: var(--color-muted); margin-top: 4px;">
                        Father: ${stud.fatherName || '-'} | Gender: ${stud.gender || '-'}
                    </div>
                </div>
                <span style="background: ${divBg}; color: ${divColor}; font-weight: 800; padding: 4px 10px; border-radius: 20px; font-size: 0.78rem; white-space: nowrap;">
                    ${divText}
                </span>
            </div>

            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; background: var(--color-background); padding: 10px; border-radius: 8px; text-align: center;">
                <div>
                    <div style="font-size: 0.7rem; color: var(--color-muted); text-transform: uppercase; font-weight: 700;">Aggregate</div>
                    <div style="font-size: 0.95rem; font-weight: 800; color: var(--color-text);">${stud.grandTotal !== undefined ? stud.grandTotal : '-'}</div>
                </div>
                <div>
                    <div style="font-size: 0.7rem; color: var(--color-muted); text-transform: uppercase; font-weight: 700;">Percentage</div>
                    <div style="font-size: 0.95rem; font-weight: 800; color: var(--color-primary);">${stud.percentage !== undefined ? stud.percentage + '%' : '-'}</div>
                </div>
                <div>
                    <div style="font-size: 0.7rem; color: var(--color-muted); text-transform: uppercase; font-weight: 700;">Rank</div>
                    <div style="font-size: 0.95rem; font-weight: 800; color: #d97706;">#${stud.rank || '-'}</div>
                </div>
            </div>

            <details style="border: 1px solid var(--color-border); border-radius: 8px; padding: 8px 12px; background: #ffffff;">
                <summary style="font-weight: 700; font-size: 0.82rem; color: var(--color-primary); cursor: pointer; user-select: none;">
                    Subject Scores Breakdown
                </summary>
                <table style="width: 100%; border-collapse: collapse; margin-top: 8px;">
                    <tbody>
                        ${subRowsHtml}
                    </tbody>
                </table>
            </details>

            <button type="button" class="btn btn-secondary print-single-card-btn" data-studentid="${stud.studentId}" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; padding: 10px; font-weight: 700; border-radius: 8px; background: var(--color-background); border: 1px solid var(--color-border); color: var(--color-text); font-size: 0.88rem; cursor: pointer; min-height: 44px;">
                <span class="material-symbols-rounded" style="font-size: 1.1rem; color: var(--color-primary);">print</span>
                Print Official Report Card
            </button>
        `;

        const printBtn = card.querySelector(".print-single-card-btn");
        if (printBtn) {
            printBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                handlePrintSingleReportCard(stud.studentId);
            });
        }

        container.appendChild(card);
    });
};


const renderTable = () => {
    const thead = document.querySelector("#results-table-thead");
    const tbody = document.querySelector("#results-table-tbody");
    const statsSummary = document.querySelector("#result-stats-summary");

    if (!thead || !tbody) return;

    thead.innerHTML = "";
    tbody.innerHTML = "";

    const activeData = currentResults.find(r => r.classVal === activeClassVal);
    if (!activeData) {
        tbody.innerHTML = '<tr><td colspan="100%" style="text-align: center; padding: 20px; color: var(--color-muted);">No results data found.</td></tr>';
        if (statsSummary) statsSummary.textContent = "0 Students Listed";
        return;
    }

    const { activeSubjects, studentResults } = activeData;

    // Filter students by search query
    const filteredStudents = studentResults.filter(stud => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return true;
        return (
            String(stud.studentName || "").toLowerCase().includes(query) ||
            String(stud.rollNo || "").toLowerCase().includes(query) ||
            String(stud.fatherName || "").toLowerCase().includes(query)
        );
    });

    // Sort students
    const sortSelect = document.querySelector("#result-sort-select");
    const sortBy = sortSelect ? sortSelect.value : "roll";
    if (sortBy === "aggregate") {
        filteredStudents.sort((a, b) => (b.grandTotal || 0) - (a.grandTotal || 0));
    } else {
        filteredStudents.sort((a, b) => {
            const rollA = parseInt(a.rollNo, 10);
            const rollB = parseInt(b.rollNo, 10);
            if (isNaN(rollA) && isNaN(rollB)) return 0;
            if (isNaN(rollA)) return 1;
            if (isNaN(rollB)) return -1;
            return rollA - rollB;
        });
    }

    if (statsSummary) {
        statsSummary.textContent = `${filteredStudents.length} Students Listed`;
    }

// View Mode Toggle Display
    if (currentViewMode === "cards") {
        if (tableWrapper) tableWrapper.style.display = "none";
        if (cardsContainer) cardsContainer.style.display = "grid";

        if (btnTable) {
            btnTable.style.background = "transparent";
            btnTable.style.color = "var(--color-muted)";
            btnTable.style.boxShadow = "none";
            btnTable.classList.remove("active");
        }
        if (btnCards) {
            btnCards.style.background = "#ffffff";
            btnCards.style.color = "var(--color-primary)";
            btnCards.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";
            btnCards.classList.add("active");
        }
        renderCardsView(cardsContainer, activeSubjects, filteredStudents);
    } else {
        if (tableWrapper) tableWrapper.style.display = "block";
        if (cardsContainer) cardsContainer.style.display = "none";

        if (btnTable) {
            btnTable.style.background = "#ffffff";
            btnTable.style.color = "var(--color-primary)";
            btnTable.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";
            btnTable.classList.add("active");
        }
        if (btnCards) {
            btnCards.style.background = "transparent";
            btnCards.style.color = "var(--color-muted)";
            btnCards.style.boxShadow = "none";
            btnCards.classList.remove("active");
        }
        const isSenior = (activeClassVal === 11 || activeClassVal === 12);

        if (isSenior) {
            renderSeniorTable(thead, tbody, activeSubjects, filteredStudents);
        } else {
            renderJuniorTable(thead, tbody, activeSubjects, filteredStudents);
        }
    }
};


// ═══════════════════════════════════════════
//  CLASS 9-10 (Junior) BSEB Layout
// ═══════════════════════════════════════════
const renderJuniorTable = (thead, tbody, activeSubjects, filteredStudents) => {
    // 6 fixed standard BSEB Class 9-10 slots (OPT SUB and OPT.SUB(VOC.) removed as requested)
    const juniorSlots = [
        { label: "MIL", slotId: "language1", defaultSubId: "" },
        { label: "SIL", slotId: "language2", defaultSubId: "" },
        { label: "MAT", slotId: "compulsory", defaultSubId: `${activeClassVal}_MAT` },
        { label: "SCI", slotId: "compulsory", defaultSubId: `${activeClassVal}_SCI` },
        { label: "SSC", slotId: "compulsory", defaultSubId: `${activeClassVal}_SST` },
        { label: "ENG", slotId: "compulsory", defaultSubId: `${activeClassVal}_ENG` }
    ];

    // Helper to check if a junior slot has practical marks configured
    const slotHasPractical = (slot) => {
        return filteredStudents.some(res => {
            let subId = "";
            if (slot.slotId === "compulsory") {
                subId = slot.defaultSubId;
            } else {
                subId = res[slot.slotId];
            }
            if (!subId) return false;
            const details = res.subjectDetails.find(s => String(s.subjectId) === String(subId));
            return details && (details.pMax || 0) > 0;
        });
    };

    const hasPrac = juniorSlots.some(slotHasPractical);

    let row1 = "";
    let row2 = "";
    let row3 = "";

    if (hasPrac) {
        // ── Three-row header (for Practical/Internal exams) ──
        row1 = `<tr style="border-bottom: 2px solid var(--color-border); background-color: var(--color-surface-hover);">
            <th rowspan="3" style="${TH_C} width: 3%;">SL NO</th>
            <th rowspan="3" style="${TH_C} width: 4%;">ROLL NO.</th>
            <th rowspan="3" style="${TH_C} width: 4%;">CLASS</th>
            <th rowspan="3" style="${TH} width: 15%;">STUDENT NAME</th>
            <th rowspan="3" style="${TH} width: 13%;">MOTHER'S NAME</th>
            <th rowspan="3" style="${TH} width: 13%;">FATHER'S NAME</th>
            <th rowspan="3" style="${TH_C} width: 3%;">GENDER</th>
            <th colspan="6" style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; ${BL} ${BB}">MARKS OBTAINED(THEORY)</th>
            <th colspan="3" style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; ${BL} ${BB}">MARKS OBTAINED (INTERNAL ASSEMENT & PRACTICAL)</th>
            <th rowspan="3" style="${TH_C} width: 7%; ${BL}">AGGREGATE</th>
            <th rowspan="3" style="${TH_C} width: 7%;">RESULT</th>
            <th rowspan="3" style="${TH_C} width: 6%;">ACTION</th>
        </tr>`;

        // Row 2: theory labels and practical category labels
        row2 = `<tr style="border-bottom: 2px solid var(--color-border); background-color: var(--color-surface-hover);">
            <th rowspan="2" style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; ${BL} width: 4.5%;">MIL</th>
            <th rowspan="2" style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; width: 4.5%;">SIL</th>
            <th rowspan="2" style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; width: 4.5%;">MAT</th>
            <th rowspan="2" style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; width: 4.5%;">SCI</th>
            <th rowspan="2" style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; width: 4.5%;">SSC</th>
            <th rowspan="2" style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; width: 4.5%;">ENG</th>
            
            <th rowspan="2" style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; ${BL} width: 4%;">SCI</th>
            <th colspan="2" style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; ${BB}">SSC</th>
        </tr>`;

        // Row 3: sub-columns for SSC practicals (LIT.ACT and Project Wrok)
        row3 = `<tr style="border-bottom: 2px solid var(--color-border); background-color: var(--color-surface-hover);">
            <th style="padding: 6px; font-weight: 600; text-align: center; font-size: 0.8em; ${BL} width: 4%;">LIT.ACT</th>
            <th style="padding: 6px; font-weight: 600; text-align: center; font-size: 0.8em; width: 4%;">Project Wrok</th>
        </tr>`;

    } else {
        // ── Two-row header (for Theory-only exams) ──
        row1 = `<tr style="border-bottom: 2px solid var(--color-border); background-color: var(--color-surface-hover);">
            <th rowspan="2" style="${TH_C} width: 3%;">SL NO</th>
            <th rowspan="2" style="${TH_C} width: 4%;">ROLL NO.</th>
            <th rowspan="2" style="${TH_C} width: 4%;">CLASS</th>
            <th rowspan="2" style="${TH} width: 17%;">STUDENT NAME</th>
            <th rowspan="2" style="${TH} width: 14%;">MOTHER'S NAME</th>
            <th rowspan="2" style="${TH} width: 14%;">FATHER'S NAME</th>
            <th rowspan="2" style="${TH_C} width: 4%;">GENDER</th>
            <th colspan="6" style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; ${BL} ${BB}">MARKS OBTAINED(THEORY)</th>
            <th rowspan="2" style="${TH_C} width: 7%; ${BL}">AGGREGATE</th>
            <th rowspan="2" style="${TH_C} width: 7%;">RESULT</th>
            <th rowspan="2" style="${TH_C} width: 6%;">ACTION</th>
        </tr>`;

        row2 = `<tr style="border-bottom: 2px solid var(--color-border); background-color: var(--color-surface-hover);">
            <th style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; ${BL} width: 5%;">MIL</th>
            <th style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; width: 5%;">SIL</th>
            <th style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; width: 5%;">MAT</th>
            <th style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; width: 5%;">SCI</th>
            <th style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; width: 5%;">SSC</th>
            <th style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; width: 5%;">ENG</th>
        </tr>`;
    }

    thead.innerHTML = row1 + row2 + row3;

    if (filteredStudents.length === 0) {
        tbody.innerHTML = `<tr><td colspan="100%" style="text-align: center; padding: 30px; color: var(--color-muted);">No matching student results found.</td></tr>`;
        return;
    }

    filteredStudents.forEach((res, index) => {
        const genderRaw = String(res.gender || "").toLowerCase().trim();
        const genderText = (genderRaw === "female" || genderRaw === "f") ? "F" : ((genderRaw === "male" || genderRaw === "m") ? "M" : "");

        let resultBadgeStyle = "color: var(--color-success); font-weight: bold;";
        if (res.result === "Fail") {
            resultBadgeStyle = "color: var(--color-danger); font-weight: bold;";
        } else if (res.result === "Compartmental") {
            resultBadgeStyle = "color: #e67e22; font-weight: bold;";
        }

        const classNumeral = activeClassVal === 10 ? 'X' : 'IX';

        // Get subject IDs
        const milId = res.language1;
        const silId = res.language2;
        const matId = `${activeClassVal}_MAT`;
        const sciId = `${activeClassVal}_SCI`;
        const sscId = `${activeClassVal}_SST`;
        const engId = `${activeClassVal}_ENG`;

        // Get theory obt marks
        const milTheory = milId ? getScore(res.subjectScores, milId, "theoryObt") : "";
        const silTheory = silId ? getScore(res.subjectScores, silId, "theoryObt") : "";
        const matTheory = getScore(res.subjectScores, matId, "theoryObt");
        const sciTheory = getScore(res.subjectScores, sciId, "theoryObt");
        const sscTheory = getScore(res.subjectScores, sscId, "theoryObt");
        const engTheory = getScore(res.subjectScores, engId, "theoryObt");

        let rowHtml = `<tr style="border-bottom: 1px solid var(--color-border); ${index % 2 === 0 ? 'background: #FFFFFF;' : 'background: #F9FAFB;'}">
            <td style="${TD_C} font-weight: 600;">${index + 1}</td>
            <td style="${TD_C} font-weight: 600;">${res.rollNo}</td>
            <td style="${TD_C} font-weight: 600;">${classNumeral}</td>
            <td style="${TD} font-weight: 600; max-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${res.studentName}">${res.studentName}</td>
            <td style="${TD} font-size: 0.9em; color: var(--color-muted); max-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${res.motherName || ""}">${res.motherName || ""}</td>
            <td style="${TD} font-size: 0.9em; color: var(--color-muted); max-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${res.fatherName || ""}">${res.fatherName || ""}</td>
            <td style="${TD_C} font-weight: 600;">${genderText}</td>
            
            <td style="${TD_C} font-weight: 600; ${BL}">${milTheory}</td>
            <td style="${TD_C} font-weight: 600;">${silTheory}</td>
            <td style="${TD_C} font-weight: 600;">${matTheory}</td>
            <td style="${TD_C} font-weight: 600;">${sciTheory}</td>
            <td style="${TD_C} font-weight: 600;">${sscTheory}</td>
            <td style="${TD_C} font-weight: 600;">${engTheory}</td>`;

        if (hasPrac) {
            // SCI Practical (from practicalObt)
            const sciPrac = getScore(res.subjectScores, sciId, "practicalObt");
            // SSC LIT.ACT (from practicalObt) and SSC Project Wrok (from internalObt)
            const sscLitAct = getScore(res.subjectScores, sscId, "practicalObt");
            const sscProjectWork = getScore(res.subjectScores, sscId, "internalObt");

            rowHtml += `
                <td style="${TD_C} font-weight: 600; ${BL}">${sciPrac}</td>
                <td style="${TD_C} font-weight: 600;">${sscLitAct}</td>
                <td style="${TD_C} font-weight: 600;">${sscProjectWork}</td>`;
        }
        rowHtml += `
            <td style="${TD_C} font-weight: 700; ${BL}">${res.grandTotal}</td>
            <td style="${TD_C} ${resultBadgeStyle}">${res.division || res.result}</td>
            <td style="${TD_C}">
                <button class="btn-print-card" data-student-id="${res.studentId}" style="padding: 4px 8px; font-size: 0.78rem; font-weight: 600; background: var(--color-primary); color: white; border: none; border-radius: var(--radius-xs); cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                    Print
                </button>
            </td>
        </tr>`;
        tbody.innerHTML += rowHtml;
    });

    tbody.querySelectorAll(".btn-print-card").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const studentId = e.currentTarget.getAttribute("data-student-id");
            handlePrintSingleReportCard(studentId);
        });
    });
};


// ═══════════════════════════════════════════
//  CLASS 11-12 (Senior) BSEB Layout
// ═══════════════════════════════════════════
const renderSeniorTable = (thead, tbody, activeSubjects, filteredStudents) => {
    // Helper to check if ANY student in the list takes a subject with practicals in this slot
    const slotHasPractical = (slotId) => {
        return filteredStudents.some(res => {
            const subId = res[slotId];
            if (!subId) return false;
            const config = activeSubjects.find(s => String(s.subjectId) === String(subId));
            return config && (config.pMax || 0) > 0;
        });
    };

    const e1HasPrac = slotHasPractical("elective1");
    const e2HasPrac = slotHasPractical("elective2");
    const e3HasPrac = slotHasPractical("elective3");
    const addHasPrac = slotHasPractical("additional");

    const e1ColSpan = e1HasPrac ? 4 : 2;
    const e2ColSpan = e2HasPrac ? 4 : 2;
    const e3ColSpan = e3HasPrac ? 4 : 2;
    const addColSpan = addHasPrac ? 4 : 2;

    const electiveColSpan = e1ColSpan + e2ColSpan + e3ColSpan;
    const additionalColSpan = addColSpan;

    // ── Row 1 ──
    let headerRow = `<tr style="border-bottom: 2px solid var(--color-border); background-color: var(--color-surface-hover);">
        <th rowspan="2" style="${TH_C} width: 4%;">Roll no.</th>
        <th rowspan="2" style="${TH_C} width: 4%;">Class</th>
        <th rowspan="2" style="${TH} width: 18%;">Student's Name<br>Mother's Name<br>Father's Name</th>
        <th rowspan="2" style="${TH_C} width: 4%;">M/F</th>
        <th colspan="4" style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; ${BL} ${BB} width: 16%;">Compulsory Language Subjects</th>
        <th colspan="${electiveColSpan}" style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; ${BL} ${BB} width: 36%;">Elective Subjects</th>
        <th colspan="${additionalColSpan}" style="padding: 8px; font-weight: 700; color: var(--color-text); text-align: center; ${BL} ${BB} width: 10%;">Additional Subjects</th>
        <th rowspan="2" style="${TH_C} width: 8%; ${BL}">Aggregate & Result</th>
        <th rowspan="2" style="${TH_C} width: 10%;">Result</th>
        <th rowspan="2" style="${TH_C} width: 6%;">Action</th>
    </tr>`;

    // ── Row 2: Sub-headers ──
    let subRow = `<tr style="border-bottom: 2px solid var(--color-border); background-color: var(--color-surface-hover);">`;
    // Compulsory languages: always Subject | Marks
    subRow += `<th style="padding: 8px; font-weight: 600; text-align: center; ${BL} width: 5%;">Subject - 1</th>`;
    subRow += `<th style="padding: 8px; font-weight: 600; text-align: center; width: 3%;">Marks</th>`;
    subRow += `<th style="padding: 8px; font-weight: 600; text-align: center; width: 5%;">Subject - 2</th>`;
    subRow += `<th style="padding: 8px; font-weight: 600; text-align: center; width: 3%;">Marks</th>`;

    // Elective 1
    subRow += `<th style="padding: 8px; font-weight: 600; text-align: center; ${BL} width: 7%;">Subject - 1</th>`;
    if (e1HasPrac) {
        subRow += `<th style="padding: 8px; font-weight: 600; text-align: center; width: 4.5%;">Theory</th>`;
        subRow += `<th style="padding: 8px; font-weight: 600; text-align: center; width: 4.5%;">Practical</th>`;
    }
    subRow += `<th style="padding: 8px; font-weight: 600; text-align: center; width: 4.5%;">Marks</th>`;

    // Elective 2
    subRow += `<th style="padding: 8px; font-weight: 600; text-align: center; ${BL} width: 7%;">Subject - 2</th>`;
    if (e2HasPrac) {
        subRow += `<th style="padding: 8px; font-weight: 600; text-align: center; width: 4.5%;">Theory</th>`;
        subRow += `<th style="padding: 8px; font-weight: 600; text-align: center; width: 4.5%;">Practical</th>`;
    }
    subRow += `<th style="padding: 8px; font-weight: 600; text-align: center; width: 4.5%;">Marks</th>`;

    // Elective 3
    subRow += `<th style="padding: 8px; font-weight: 600; text-align: center; ${BL} width: 7%;">Subject - 3</th>`;
    if (e3HasPrac) {
        subRow += `<th style="padding: 8px; font-weight: 600; text-align: center; width: 4.5%;">Theory</th>`;
        subRow += `<th style="padding: 8px; font-weight: 600; text-align: center; width: 4.5%;">Practical</th>`;
    }
    subRow += `<th style="padding: 8px; font-weight: 600; text-align: center; width: 4.5%;">Marks</th>`;

    // Additional
    subRow += `<th style="padding: 8px; font-weight: 600; text-align: center; ${BL} width: 7%;">Subject</th>`;
    if (addHasPrac) {
        subRow += `<th style="padding: 8px; font-weight: 600; text-align: center; width: 4.5%;">Theory</th>`;
        subRow += `<th style="padding: 8px; font-weight: 600; text-align: center; width: 4.5%;">Practical</th>`;
    }
    subRow += `<th style="padding: 8px; font-weight: 600; text-align: center; width: 4.5%;">Marks</th>`;

    subRow += `</tr>`;
    thead.innerHTML = headerRow + subRow;

    if (filteredStudents.length === 0) {
        tbody.innerHTML = `<tr><td colspan="100%" style="text-align: center; padding: 30px; color: var(--color-muted);">No matching student results found.</td></tr>`;
        return;
    }

    filteredStudents.forEach((res, index) => {
        const getSubDetails = (subId) => {
            if (!subId) return null;
            return res.subjectDetails.find(s => String(s.subjectId) === String(subId)) || null;
        };

        const l1 = getSubDetails(res.language1);
        const l2 = getSubDetails(res.language2);
        const e1 = getSubDetails(res.elective1);
        const e2 = getSubDetails(res.elective2);
        const e3 = getSubDetails(res.elective3);
        const add = getSubDetails(res.additional);

        const getSubData = (subObj) => {
            if (!subObj) return { name: "", theoryObt: "", practicalObt: "", totalObt: "", score: "", tMax: "", pMax: 0 };
            const scoreObj = res.subjectScores[subObj.subjectId];
            return {
                name: subObj.name,
                theoryObt: scoreObj ? scoreObj.theoryObt : "",
                practicalObt: scoreObj ? scoreObj.practicalObt : "",
                totalObt: scoreObj ? scoreObj.totalObt : "",
                score: scoreObj ? scoreObj.displayVal : "",
                tMax: subObj.tMax || "",
                pMax: subObj.pMax || 0
            };
        };

        const sdL1 = getSubData(l1);
        const sdL2 = getSubData(l2);
        const sdE1 = getSubData(e1);
        const sdE2 = getSubData(e2);
        const sdE3 = getSubData(e3);
        const sdAdd = getSubData(add);

        let combinedName = `<div style="text-align:left; font-weight:600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${res.studentName}">${res.studentName}</div>`;
        if (res.motherName && res.motherName !== "-") {
            combinedName += `<div style="text-align:left; font-size: 0.8em; color: var(--color-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${res.motherName}">${res.motherName}</div>`;
        }
        if (res.fatherName && res.fatherName !== "-") {
            combinedName += `<div style="text-align:left; font-size: 0.8em; color: var(--color-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${res.fatherName}">${res.fatherName}</div>`;
        }
        const genderRaw = String(res.gender || "").toLowerCase().trim();
        const genderText = (genderRaw === "female" || genderRaw === "f") ? "F" : ((genderRaw === "male" || genderRaw === "m") ? "M" : "");

        let resultBadgeStyle = "color: var(--color-success); font-weight: bold;";
        if (res.result === "Fail") {
            resultBadgeStyle = "color: var(--color-danger); font-weight: bold;";
        } else if (res.result === "Compartmental") {
            resultBadgeStyle = "color: #e67e22; font-weight: bold;";
        }

        let rowHtml = `<tr style="border-bottom: 1px solid var(--color-border); ${index % 2 === 0 ? 'background: #FFFFFF;' : 'background: #F9FAFB;'}">
            <td style="${TD_C} font-weight: 600; color: var(--color-primary);">${res.rollNo}</td>
            <td style="${TD_C} font-weight: 600; color: var(--color-primary);">${activeClassVal}</td>
            <td style="${TD} line-height: 1.3; max-width: 0;">${combinedName}</td>
            <td style="${TD_C} font-weight: 600;">${genderText}</td>`;

        // Compulsory Language 1
        rowHtml += `<td style="${TD_C} font-size: 0.85em; ${BL}">${sdL1.name}</td>`;
        rowHtml += `<td style="${TD_C} font-weight: 600;">${sdL1.totalObt}</td>`;

        // Compulsory Language 2
        rowHtml += `<td style="${TD_C} font-size: 0.85em;">${sdL2.name}</td>`;
        rowHtml += `<td style="${TD_C} font-weight: 600;">${sdL2.totalObt}</td>`;

        // Helper to output cells for a slot based on whether slot has practical
        const renderSlotCells = (sd, slotHasPrac, isLeftBorder = false) => {
            let cellsHtml = `<td style="${TD_C} font-size: 0.85em; ${isLeftBorder ? BL : ''}">${sd.name}</td>`;
            if (slotHasPrac) {
                if (sd.pMax > 0) {
                    cellsHtml += `<td style="${TD_C} font-weight: 600;">${sd.theoryObt}</td>`;
                    cellsHtml += `<td style="${TD_C} font-weight: 600;">${sd.practicalObt}</td>`;
                } else {
                    cellsHtml += `<td style="${TD_C} color: var(--color-muted);">-</td>`;
                    cellsHtml += `<td style="${TD_C} color: var(--color-muted);">-</td>`;
                }
            }
            cellsHtml += `<td style="${TD_C} font-weight: 600;">${sd.totalObt}</td>`;
            return cellsHtml;
        };

        // Elective 1
        rowHtml += renderSlotCells(sdE1, e1HasPrac, true);

        // Elective 2
        rowHtml += renderSlotCells(sdE2, e2HasPrac, false);

        // Elective 3
        rowHtml += renderSlotCells(sdE3, e3HasPrac, false);

        // Additional
        rowHtml += renderSlotCells(sdAdd, addHasPrac, true);

        rowHtml += `
            <td style="${TD_C} font-weight: 700; ${BL}">${res.grandTotal}</td>
            <td style="${TD_C} ${resultBadgeStyle}">${res.division || res.result}</td>
            <td style="${TD_C}">
                <button class="btn-print-card" data-student-id="${res.studentId}" style="padding: 4px 8px; font-size: 0.78rem; font-weight: 600; background: var(--color-primary); color: white; border: none; border-radius: var(--radius-xs); cursor: pointer; display: inline-flex; align-items: center; gap: 4px;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>
                    Print
                </button>
            </td>
        </tr>`;
        tbody.innerHTML += rowHtml;
    });

    tbody.querySelectorAll(".btn-print-card").forEach(btn => {
        btn.addEventListener("click", (e) => {
            const studentId = e.currentTarget.getAttribute("data-student-id");
            handlePrintSingleReportCard(studentId);
        });
    });
};


/**
 * Calls backend to compile results and displays them in-page.
 */
const handleGenerateResults = async () => {
    const yearSelect = document.querySelector("#filter-academic-year");
    const examSelect = document.querySelector("#filter-exam");
    const sectionSelect = document.querySelector("#filter-section");
    const streamSelect = document.querySelector("#filter-stream");
    const checkedClasses = getCheckedClasses();

    const filters = {
        academicYear: yearSelect.value,
        examName: examSelect.value,
        classes: checkedClasses.join(","),
        section: sectionSelect.value,
        stream: streamSelect ? streamSelect.value : ""
    };

    if (!filters.academicYear || !filters.examName || !filters.classes || !filters.section) {
        showToast("Please select at least one class and fill all filters.", "error");
        return;
    }

    const outputCard = document.querySelector("#results-output-card");
    if (outputCard) outputCard.style.display = "none";

    showLoader();

    try {
        const query = new URLSearchParams(filters).toString();
        const response = await apiRequest(`exam.results.generate?${query}`);

        if (response.success && response.classesResults) {
            currentResults = response.classesResults;

            if (currentResults.length > 0) {
                activeClassVal = currentResults[0].classVal;
                renderTabs();
                renderTable();

                if (outputCard) {
                    outputCard.style.display = "block";
                    setTimeout(() => {
                        outputCard.scrollIntoView({ behavior: "smooth", block: "start" });
                    }, 100);
                }
                showToast("Results compiled successfully!", "success");
            } else {
                showToast("No results compiled. Please verify filters.", "warning");
            }
        }
    } catch (error) {
        console.error(error);
        showToast(error.message || "Failed to generate results.", "error");
    } finally {
        hideLoader();
    }
};

/**
 * Exports the currently displayed HTML table to an Excel file with exact formatting.
 */
const handleExportToExcel = () => {
    const table = document.querySelector(".data-table");
    if (!table) {
        showToast("No data available to export.", "error");
        return;
    }

    const yearSelect = document.querySelector("#filter-academic-year");
    const examSelect = document.querySelector("#filter-exam");
    const sectionSelect = document.querySelector("#filter-section");

    const year = yearSelect ? yearSelect.value : "";
    const examName = examSelect ? examSelect.value : "";
    const section = sectionSelect ? sectionSelect.value : "";

    const filename = `Results_Class_${activeClassVal}_${examName.replace(/\s+/g, '_')}_Section_${section}_${year}.xls`;

    // Clone table to clean styles
    const clonedTable = table.cloneNode(true);
    const html = clonedTable.outerHTML;
    const template = `
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <!--[if gte mso 9]>
  <xml>
    <x:ExcelWorkbook>
      <x:ExcelWorksheets>
        <x:ExcelWorksheet>
          <x:Name>Class ${activeClassVal} Results</x:Name>
          <x:WorksheetOptions>
            <x:DisplayGridlines/>
          </x:WorksheetOptions>
        </x:ExcelWorksheet>
      </x:ExcelWorksheets>
    </x:ExcelWorkbook>
  </xml>
  <![endif]-->
  <style>
    table { border-collapse: collapse; font-family: Arial, sans-serif; }
    th { background-color: #F3F4F6; color: #111827; border: 1px solid #D1D5DB; font-weight: bold; text-align: center; font-size: 11px; padding: 6px; }
    td { border: 1px solid #E5E7EB; padding: 6px; text-align: center; font-size: 11px; }
  </style>
</head>
<body>
  ${html}
</body>
</html>
    `;

    const blob = new Blob([template], { type: "application/vnd.ms-excel;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("Excel spreadsheet exported successfully!", "success");
};


/**
 * Initializes the Result Generation module view.
 */
export async function initResultGenerationView() {
    try {
        renderNavbar(document.querySelector("#navbar-result-generation"));

        // Setup defaults
        const yearInput = document.querySelector("#filter-academic-year");
        if (yearInput) {
            const years = getAcademicYears();
            yearInput.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join("");
            yearInput.value = getDefaultAcademicYear();
        }

        const examSelect = document.querySelector("#filter-exam");
        if (examSelect) {
            try {
                const res = await apiRequest("exam.list");
                if (res.success && res.exams) {
                    examSelect.innerHTML = '<option value="">Select Exam</option>';
                    res.exams.forEach(exam => {
                        examSelect.innerHTML += `<option value="${exam.name}">${exam.name}</option>`;
                    });
                }
            } catch (err) {
                console.error("Failed to load exams list:", err);
            }
        }

        // Setup filter listeners
        const generateBtn = document.querySelector("#generate-results-btn");
        const searchInput = document.querySelector("#result-search-input");

        document.querySelectorAll('input[name="classes"]').forEach(el => {
            el.addEventListener("change", async () => {
                updateStreamFilterVisibility();
                await updateAvailableSections();
            });
        });

        if (yearInput) {
            yearInput.addEventListener("input", async () => {
                await updateAvailableSections();
            });
        }

        if (generateBtn) {
            generateBtn.addEventListener("click", handleGenerateResults);
        }

        if (searchInput) {
            searchInput.addEventListener("input", (e) => {
                searchQuery = e.target.value;
                renderTable();
            });
        }

        const sortSelect = document.querySelector("#result-sort-select");
        if (sortSelect) {
            sortSelect.addEventListener("change", () => {
                renderTable();
            });
        }

        const exportBtn = document.querySelector("#export-excel-btn");
        if (exportBtn) {
            exportBtn.addEventListener("click", handleExportToExcel);
        }

        const printAllBtn = document.querySelector("#print-all-cards-btn");
        if (printAllBtn) {
            printAllBtn.addEventListener("click", handlePrintAllReportCards);
        }

        // Setup view mode toggle listeners
        const btnTable = document.querySelector("#toggle-view-table");
        const btnCards = document.querySelector("#toggle-view-cards");

        if (btnTable) {
            btnTable.addEventListener("click", () => {
                currentViewMode = "table";
                renderTable();
            });
        }

        if (btnCards) {
            btnCards.addEventListener("click", () => {
                currentViewMode = "cards";
                renderTable();
            });
        }

        // Initial setup
        updateStreamFilterVisibility();
        await updateAvailableSections();

    } catch (error) {
        console.error(error);
        showToast("Result Generation could not be initialized.", "error");
    }
}
